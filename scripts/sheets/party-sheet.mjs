export default class PartySheet extends foundry.appv1.sheets.ActorSheet {
	/** @inheritdoc */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["shadowdark", "sheet", "party"],
			width: 700,
			height: 550,
			resizable: true,
			dragDrop: [{ dropSelector: null }],
			tabs: [
				{
					navSelector: ".SD-nav",
					contentSelector: ".SD-content-body",
					initial: "tab-members",
				},
			],
		});
	}

	/** @inheritdoc */
	get template() {
		return "modules/shadowdark-party-token/templates/party-sheet.hbs";
	}

	/** @inheritdoc */
	async getData(options) {
		const context = await super.getData(options);
		const resolved = await this.actor.system.resolveMembers();

		context.characters = resolved.filter(m => m.role === "character");
		context.followers = resolved.filter(m => m.role === "follower");
		context.isEmpty = resolved.length === 0;
		context.editable = this.isEditable;

		// Inventory tab data
		const inventory = await this.actor.system.resolveInventory();
		const grouped = {};
		for (const item of inventory) {
			const typeLabel = CONFIG.Item?.typeLabels?.[item.type]
				? game.i18n.localize(CONFIG.Item.typeLabels[item.type])
				: item.type;
			if (!grouped[typeLabel]) grouped[typeLabel] = [];
			grouped[typeLabel].push(item);
		}
		context.inventoryGroups = Object.entries(grouped).map(
			([label, items]) => ({ label, items })
		);
		context.hasInventory = inventory.length > 0;

		return context;
	}

	/** @inheritdoc */
	activateListeners(html) {
		super.activateListeners(html);

		if (!this.isEditable) return;

		html.find("[data-action='remove-member']").click(
			event => this._onRemoveMember(event)
		);

		html.find("[data-action='toggle-role']").click(
			event => this._onToggleRole(event)
		);

		html.find("[data-action='open-sheet']").click(
			event => this._onOpenSheet(event)
		);
	}

	/** @inheritdoc */
	async _onDropActor(event, data) {
		if (!this.isEditable) return;

		const actor = await fromUuid(data.uuid);
		if (!actor) return;

		if (actor.type !== "Player" && actor.type !== "NPC") {
			ui.notifications.warn(
				game.i18n.localize("PARTY.warnings.invalidType")
			);
			return;
		}

		if (this.actor.system.hasMember(data.uuid)) {
			ui.notifications.warn(
				game.i18n.localize("PARTY.warnings.duplicate")
			);
			return;
		}

		const defaultRole = actor.type === "Player" ? "character" : "follower";
		const members = [...this.actor.system.members.map(m => ({
			uuid: m.uuid,
			role: m.role,
		}))];

		members.push({ uuid: data.uuid, role: defaultRole });

		await this.actor.update({ "system.members": members });
	}

	/**
	 * Remove a member from the party.
	 * @param {Event} event
	 */
	async _onRemoveMember(event) {
		event.preventDefault();
		const uuid = event.currentTarget.closest("[data-uuid]").dataset.uuid;

		const members = this.actor.system.members
			.filter(m => m.uuid !== uuid)
			.map(m => ({ uuid: m.uuid, role: m.role }));

		await this.actor.update({ "system.members": members });
	}

	/**
	 * Toggle a member between character and follower.
	 * @param {Event} event
	 */
	async _onToggleRole(event) {
		event.preventDefault();
		const uuid = event.currentTarget.closest("[data-uuid]").dataset.uuid;

		const members = this.actor.system.members.map(m => {
			if (m.uuid === uuid) {
				return {
					uuid: m.uuid,
					role: m.role === "character" ? "follower" : "character",
				};
			}
			return { uuid: m.uuid, role: m.role };
		});

		await this.actor.update({ "system.members": members });
	}

	/**
	 * Open the sheet for a referenced actor.
	 * @param {Event} event
	 */
	async _onOpenSheet(event) {
		event.preventDefault();
		const uuid = event.currentTarget.closest("[data-uuid]").dataset.uuid;
		const actor = await fromUuid(uuid);
		actor?.sheet?.render(true);
	}
}
