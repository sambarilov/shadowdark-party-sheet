const fields = foundry.data.fields;

export default class PartyDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			members: new fields.ArrayField(
				new fields.SchemaField({
					uuid: new fields.DocumentUUIDField({ type: "Actor" }),
					role: new fields.StringField({
						initial: "character",
						choices: ["character", "follower"],
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
}
