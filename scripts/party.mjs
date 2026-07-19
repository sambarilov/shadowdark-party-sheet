import PartyDataModel from "./data/party-model.mjs";
import PartySheet from "./sheets/party-sheet.mjs";

const MODULE_ID = "shadowdark-party-token";

Hooks.once("init", () => {
	// Register the Party data model
	Object.assign(CONFIG.Actor.dataModels, {
		[`${MODULE_ID}.party`]: PartyDataModel,
	});

	// Register the Party sheet
	DocumentSheetConfig.registerSheet(Actor, MODULE_ID, PartySheet, {
		types: [`${MODULE_ID}.party`],
		makeDefault: true,
		label: "PARTY.sheet.name",
	});
});
