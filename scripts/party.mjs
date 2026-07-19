import PartyDataModel from "./data/party-model.mjs";
import PartySheet from "./sheets/party-sheet.mjs";

const MODULE_ID = "shadowdark-party-sheet";
const PARTY_TYPE = `${MODULE_ID}.party`;

/** Cached light source templates from the Shadowdark system. */
let lightSourceMap = null;

const NO_LIGHT = {
	alpha: 0, angle: 360, bright: 0, color: null, coloration: 1,
	dim: 0, attenuation: 0.5, luminosity: 0.5, saturation: 0,
	contrast: 0, shadows: 0,
	animation: { speed: 0, intensity: 0, reverse: false, type: null },
	darkness: { min: 0, max: 1 },
};

Hooks.once("init", () => {
	// Register the Party data model
	Object.assign(CONFIG.Actor.dataModels, {
		[PARTY_TYPE]: PartyDataModel,
	});

	// Register the Party sheet
	DocumentSheetConfig.registerSheet(Actor, MODULE_ID, PartySheet, {
		types: [PARTY_TYPE],
		makeDefault: true,
		label: "PARTY.sheet.name",
	});
});

Hooks.once("ready", async () => {
	// Cache the Shadowdark light source mapping
	try {
		lightSourceMap = await foundry.utils.fetchJsonWithTimeout(
			"systems/shadowdark/assets/mappings/map-light-sources.json"
		);
	} catch (e) {
		console.warn(`${MODULE_ID} | Could not load light source mappings`, e);
		lightSourceMap = {};
	}
});

/**
 * Sync the party token's light to the best active light source among members.
 * @param {Actor} partyActor  The party actor document.
 */
async function syncPartyLight(partyActor) {
	if (!canvas.scene || !lightSourceMap) return;

	const token = canvas.scene.tokens.find(
		t => t.actorId === partyActor.id
	);
	if (!token) return;

	// Only sync light if tracking is enabled for this token
	if (!token.getFlag(MODULE_ID, "trackLight")) return;

	const bestLight = await partyActor.system.resolveBestLight(lightSourceMap);
	const lightData = bestLight ? foundry.utils.deepClone(bestLight) : NO_LIGHT;

	await token.update({ light: lightData });
}

/**
 * Find all party actors that include a given actor as a member.
 * @param {string} actorId
 * @returns {Actor[]}
 */
function getPartyActorsContaining(actorId) {
	return game.actors.filter(
		a => a.type === PARTY_TYPE
			&& a.system.members.some(m => m.uuid.endsWith(actorId))
	);
}

// When a light item is toggled on/off, sync any party that contains its owner
Hooks.on("updateItem", (item, changes, _options, _userId) => {
	if (!foundry.utils.hasProperty(changes, "system.light.active")) return;
	const actor = item.parent;
	if (!actor || actor.documentName !== "Actor") return;

	for (const party of getPartyActorsContaining(actor.id)) {
		syncPartyLight(party);
	}
});

// When a party actor's members change, re-sync its light
Hooks.on("updateActor", (actor, changes, _options, _userId) => {
	if (actor.type !== PARTY_TYPE) return;
	if (!foundry.utils.hasProperty(changes, "system.members")) return;
	syncPartyLight(actor);
});

// When the party token is first placed on a scene, ask about light tracking
Hooks.on("createToken", async (tokenDoc, _options, _userId) => {
	const actor = tokenDoc.actor;
	if (actor?.type !== PARTY_TYPE) return;

	const trackLight = await Dialog.confirm({
		title: game.i18n.localize("PARTY.lightTracking.title"),
		content: `<p>${game.i18n.localize("PARTY.lightTracking.content")}</p>`,
		defaultYes: false,
	});

	await tokenDoc.setFlag(MODULE_ID, "trackLight", trackLight);

	if (trackLight) {
		syncPartyLight(actor);
	}
});
