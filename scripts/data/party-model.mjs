const fields = foundry.data.fields;

export default class PartyDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			members: new fields.ArrayField(
				new fields.SchemaField({
					uuid: new fields.DocumentUUIDField({ type: "Actor" }),
					role: new fields.StringField({
						initial: "character",
						choices: ["character", "follower", "asset"],
					}),
				})
			),
		};
	}

	/**
	 * Resolve all member UUIDs to actor documents and gather display data.
	 * @returns {Promise<object[]>} Array of resolved member data objects.
	 */
	async resolveMembers() {
		const resolved = [];

		for (const member of this.members) {
			const actor = await fromUuid(member.uuid);

			if (!actor) {
				resolved.push({
					uuid: member.uuid,
					role: member.role,
					missing: true,
					name: game.i18n.localize("PARTY.member.missing"),
				});
				continue;
			}

			const data = {
				uuid: member.uuid,
				role: member.role,
				missing: false,
				name: actor.name,
				img: actor.img,
				level: actor.system.level?.value ?? 0,
				isPlayer: actor.type === "Player",
			};

			if (actor.type === "Player") {
				const ancestryItem = actor.system.ancestry
					? await fromUuid(actor.system.ancestry)
					: null;
				const classItem = actor.system.class
					? await fromUuid(actor.system.class)
					: null;

				data.ancestry = ancestryItem?.name ?? "—";
				data.className = classItem?.name ?? "—";

				const slotUsage = actor.system.getSlotUsage();
				data.slotsUsed = slotUsage.total;
				data.slotsTotal = actor.system.slots;
			} else {
				data.ancestry = "—";
				data.className = game.i18n.localize("PARTY.member.npc");
				data.slotsUsed = null;
				data.slotsTotal = null;
			}

			resolved.push(data);
		}

		return resolved;
	}

	/**
	 * Check if an actor UUID is already in the party.
	 * @param {string} uuid
	 * @returns {boolean}
	 */
	hasMember(uuid) {
		return this.members.some(m => m.uuid === uuid);
	}

	/**
	 * Build a consolidated inventory across all party members.
	 * Items are grouped by name+type, with per-member quantities tracked.
	 * @returns {Promise<object[]>} Sorted array of grouped item entries.
	 */
	async resolveInventory() {
		const itemMap = new Map();

		for (const member of this.members) {
			const actor = await fromUuid(member.uuid);
			if (!actor) continue;

			for (const item of actor.items) {
				if (!item.system.isPhysical) continue;

				const key = `${item.name}:::${item.type}`;
				if (!itemMap.has(key)) {
					itemMap.set(key, {
						name: item.name,
						img: item.img,
						type: item.type,
						totalQuantity: 0,
						owners: [],
					});
				}

				const entry = itemMap.get(key);
				const qty = item.system.quantity ?? 1;
				entry.totalQuantity += qty;

				const existing = entry.owners.find(o => o.name === actor.name);
				if (existing) {
					existing.quantity += qty;
				} else {
					entry.owners.push({
						name: actor.name,
						quantity: qty,
					});
				}
			}
		}

		return [...itemMap.values()].sort((a, b) => {
			if (a.type !== b.type) return a.type.localeCompare(b.type);
			return a.name.localeCompare(b.name);
		});
	}

	/**
	 * Find the best (brightest) active light source across all party members.
	 * @param {object} lightSourceMap  Cached light source templates from the system JSON.
	 * @returns {Promise<object|null>} The light config object, or null if none active.
	 */
	async resolveBestLight(lightSourceMap) {
		let bestLight = null;
		let bestBright = -1;

		for (const member of this.members) {
			const actor = await fromUuid(member.uuid);
			if (!actor) continue;

			for (const item of actor.items) {
				if (!item.system.light?.isSource || !item.system.light?.active) continue;

				const template = item.system.light.template;
				const entry = lightSourceMap[template];
				if (!entry?.light) continue;

				if (entry.light.bright > bestBright) {
					bestBright = entry.light.bright;
					bestLight = entry.light;
				}
			}
		}

		return bestLight;
	}
}
