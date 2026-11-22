import { openPrintedPage } from "./books.js";
import { buildPage, resolveActing } from "./pages.js";
import { openPack } from "./packs.js";
import {
    awardKarma,
    awardNuyen,
    buyCatalogWithKarma,
    buyCatalogWithNuyen,
    createContact,
    createSin,
    deleteItem,
    installSoftware,
    payLifestyleMonth,
    raiseAttribute,
    raiseInitiation,
    raiseSkill,
    raiseSubmersion,
    removeAugmentation,
    removeQuality,
    setSpecialization,
    uninstallSoftware,
    updateContact,
} from "./apply.js";
import { reportChange } from "./chat.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const DATA_FIELDS = [
    "kind", "itemId", "skill", "spec", "attr", "pack", "documentId", "price",
    "track", "delta", "deviceId", "awardKarma", "awardNuyen", "awardHeat",
    "awardReputation", "go",
];

function dataAttribute(key) {
    return "data-" + key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export class CharWizard extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "sr6-char-wizard",
        classes: ["sr6-char-wizard"],
        tag: "form",
        window: {
            icon: "fas fa-user-gear",
            resizable: true,
            minimizable: true,
        },
        position: {
            width: 780,
            height: 640,
        },
        form: {
            submitOnChange: false,
            closeOnSubmit: false,
        },
        actions: {},
    };

    static PARTS = {
        wizard: {
            template: "modules/sr6-char-wizard/templates/wizard.hbs",
            scrollable: [".sr6cw-scroll"],
        },
    };

    static {
        this.DEFAULT_OPTIONS.form.handler = this.#onSubmit;
        this.DEFAULT_OPTIONS.actions = {
            choose: this.#onChoose,
            book: this.#onBook,
            actor: this.#onActor,
            sheet: this.#onSheet,
            search: this.#onSearch,
            pack: this.#onPack,
            crumb: this.#onCrumb,
            "raise-skill": this.#onRaiseSkill,
            "raise-attr": this.#onRaiseAttr,
            "buy-spec": this.#onBuySpec,
            "buy-expertise": this.#onBuyExpertise,
            "raise-initiation": this.#onRaiseInitiation,
            "raise-submersion": this.#onRaiseSubmersion,
            "buy-karma": this.#onBuyKarma,
            "buy-nuyen": this.#onBuyNuyen,
            "buy-mod": this.#onBuyMod,
            "buy-ammo": this.#onBuyAmmo,
            "remove-quality": this.#onRemoveQuality,
            "add-contact": this.#onAddContact,
            "contact-bump": this.#onContactBump,
            "add-sin": this.#onAddSin,
            "pay-lifestyle": this.#onPayLifestyle,
            "remove-aug": this.#onRemoveAug,
            "install-soft": this.#onInstallSoft,
            "uninstall-soft": this.#onUninstallSoft,
            "delete-item": this.#onDeleteItem,
            "open-item": this.#onOpenItem,
            "award-selected": this.#onAwardSelected,
            noop: () => {},
        };
    }

    static #app = null;

    static show(actor) {
        if (!this.#app) this.#app = new CharWizard();
        const app = this.#app;
        app.char.actorUuid = actor?.uuid ?? null;
        if (!app.rendered) {
            app.char.pageId = "home";
            app.char.history = [];
            app.char.data = {};
            app.char.label = "";
        }
        app.render({ force: true });
        return app;
    }

    constructor(options = {}) {
        super(options);
        this.char = {
            actorUuid: null,
            pageId: "home",
            history: [],
            data: {},
            label: "",
        };
    }

    get title() {
        const actor = this.actor;
        return actor ? `Character — ${actor.name}` : "Character Wizard";
    }

    get actor() {
        return resolveActing(this.char).actor;
    }

    selectionChanged() {
        const before = this.actor?.uuid ?? null;
        this.char.actorUuid = null;
        if (this.actor?.uuid !== before && this.char.pageId !== "home") {
            this.char.pageId = "home";
            this.char.history = [];
            this.char.data = {};
            this.char.label = "";
        }
        if (this.rendered) this.render();
    }

    async _prepareContext(options) {
        const context = typeof super._prepareContext === "function"
            ? await super._prepareContext(options)
            : {};
        const page = await buildPage(this.char);
        delete page.actor;
        return { ...context, ...page };
    }

    static async #onSubmit(event, form) {
        const query = form?.querySelector?.("[name=compendiumQuery]")?.value;
        this.char.data = readFormData(this.char.data, form);
        return this.render();
    }

    static async #onChoose(event, target) {
        event.preventDefault();
        if (target.disabled) return;
        const patch = readPatch(target);
        const pageId = target.dataset.go;
        if (!pageId) return;
        if (pageId === "awards" && !game.user.isGM) {
            ui.notifications.warn("Only a gamemaster can open session awards.");
            return;
        }
        await this.#navigate(pageId, patch, target.dataset.label || cleanLabel(target));
    }

    static async #onCrumb(event, target) {
        event.preventDefault();
        const index = Number(target.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index >= this.char.history.length) return;
        const previous = this.char.history[index];
        this.char.history = this.char.history.slice(0, index);
        this.#restore(previous);
        return this.render();
    }

    static async #onBook(event, target) {
        event.preventDefault();
        event.stopPropagation();
        const book = target.dataset.book;
        const page = Number(target.dataset.page);
        if (!book || !page) return;
        await openPrintedPage(book, page);
    }

    static async #onActor(event, target) {
        event.preventDefault();
        const uuid = target.dataset.actorUuid;
        if (!uuid || uuid === this.char.actorUuid) return;
        this.char.history.push(this.#snapshot());
        this.char.actorUuid = uuid;
        this.char.pageId = "home";
        this.char.data = {};
        this.char.label = "";
        return this.render();
    }

    static async #onSheet(event, target) {
        event.preventDefault();
        const doc = fromUuidSync(target.dataset.uuid);
        const actor = doc?.actor ?? doc;
        if (!actor?.sheet) return;
        if (!actor.testUserPermission(game.user, "LIMITED")) {
            ui.notifications.warn(`You cannot view ${target.dataset.name || actor.name}'s sheet.`);
            return;
        }
        actor.sheet.render(true);
    }

    static async #onSearch(event) {
        event.preventDefault();
        this.char.data = readFormData(this.char.data, this.element);
        return this.render();
    }

    static async #onPack(event, target) {
        event.preventDefault();
        await openPack(target.dataset.pack || this.char.data.pack);
    }

    static async #onRaiseSkill(event, target) {
        event.preventDefault();
        if (await raiseSkill(this.actor, target.dataset.skill)) return this.render();
    }

    static async #onRaiseAttr(event, target) {
        event.preventDefault();
        if (await raiseAttribute(this.actor, target.dataset.attr)) return this.render();
    }

    static async #onBuySpec(event, target) {
        event.preventDefault();
        const name = target.dataset.spec || this.element?.querySelector?.("[name=specName]")?.value;
        if (!name) {
            ui.notifications.warn("Name the specialization first.");
            return;
        }
        if (await setSpecialization(this.actor, target.dataset.skill, name, false)) return this.render();
    }

    static async #onBuyExpertise(event, target) {
        event.preventDefault();
        if (await setSpecialization(this.actor, target.dataset.skill, target.dataset.spec, true)) return this.render();
    }

    static async #onRaiseInitiation(event) {
        event.preventDefault();
        if (await raiseInitiation(this.actor)) return this.render();
    }

    static async #onRaiseSubmersion(event) {
        event.preventDefault();
        if (await raiseSubmersion(this.actor)) return this.render();
    }

    static async #onBuyKarma(event, target) {
        event.preventDefault();
        const price = Number(target.dataset.price) || 0;
        const created = await buyCatalogWithKarma(
            this.actor,
            target.dataset.pack,
            target.dataset.documentId,
            price,
            target.dataset.label || cleanLabel(target),
        );
        if (created) return this.render();
    }

    static async #onBuyNuyen(event, target) {
        event.preventDefault();
        const price = Number(target.dataset.price) || 0;
        const created = await buyCatalogWithNuyen(
            this.actor,
            target.dataset.pack,
            target.dataset.documentId,
            price,
            target.dataset.label || cleanLabel(target),
        );
        if (!created || created.pending) return this.render();
        if (target.dataset.pack === "weapons") {
            await this.#navigate("weapon-detail", { itemId: created.id }, created.name);
            return;
        }
        if (target.dataset.pack === "software") {
            ui.notifications.info("Software added. Slot it from Deck / RCC programs.");
        }
        return this.render();
    }

    static async #onBuyMod(event, target) {
        event.preventDefault();
        const weapon = this.actor?.items?.get(target.dataset.itemId);
        if (!weapon) return;
        const created = await buyCatalogWithNuyen(
            this.actor,
            target.dataset.pack || "weaponMods",
            target.dataset.documentId,
            Number(target.dataset.price) || 0,
            target.dataset.label || cleanLabel(target),
            {
                mode: "buy-mod",
                attachToUuid: weapon.uuid,
                attachToName: weapon.name,
            },
        );
        if (!created || created.pending) return this.render();
        return this.render();
    }

    static async #onBuyAmmo(event, target) {
        event.preventDefault();
        const weapon = this.actor?.items?.get(target.dataset.itemId);
        if (!weapon) return;
        const created = await buyCatalogWithNuyen(
            this.actor,
            target.dataset.pack || "ammunition",
            target.dataset.documentId,
            Number(target.dataset.price) || 0,
            target.dataset.label || cleanLabel(target),
            {
                mode: "buy-ammo",
                attachToUuid: weapon.uuid,
                attachToName: weapon.name,
            },
        );
        if (!created || created.pending) return this.render();
        return this.render();
    }

    static async #onRemoveQuality(event, target) {
        event.preventDefault();
        const item = this.actor?.items?.get(target.dataset.itemId);
        if (!item) return;
        const cost = (Number(item.system?.value) || 0) * 2;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Buy off quality" },
            content: `<p>Remove <strong>${item.name}</strong> for <strong>${cost} Karma</strong> (2 × listed value)?</p>`,
        });
        if (!ok) return;
        if (await removeQuality(this.actor, item.id)) return this.render();
    }

    static async #onAddContact(event) {
        event.preventDefault();
        const created = await createContact(this.actor);
        if (created) {
            await this.#navigate("contacts", { itemId: created.id }, created.name);
        }
    }

    static async #onContactBump(event, target) {
        event.preventDefault();
        const item = this.actor?.items?.get(target.dataset.itemId);
        if (!item) return;
        const track = target.dataset.track;
        const delta = Number(target.dataset.delta) || 0;
        const current = Number(item.system[track]) || 0;
        await updateContact(this.actor, item.id, { [track]: Math.max(0, current + delta) });
        return this.render();
    }

    static async #onAddSin(event) {
        event.preventDefault();
        const created = await createSin(this.actor);
        if (created) return this.render();
    }

    static async #onPayLifestyle(event, target) {
        event.preventDefault();
        if (await payLifestyleMonth(this.actor, target.dataset.itemId)) return this.render();
    }

    static async #onRemoveAug(event, target) {
        event.preventDefault();
        const item = this.actor?.items?.get(target.dataset.itemId);
        if (!item) return;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Uninstall augmentation" },
            content: `<p>Remove <strong>${item.name}</strong> from the sheet? Essence recalculates after delete. Surgery time is a table call.</p>`,
        });
        if (!ok) return;
        if (await removeAugmentation(this.actor, item.id)) return this.render();
    }

    static async #onInstallSoft(event, target) {
        event.preventDefault();
        if (await installSoftware(this.actor, target.dataset.itemId, target.dataset.deviceId)) return this.render();
    }

    static async #onUninstallSoft(event, target) {
        event.preventDefault();
        if (await uninstallSoftware(this.actor, target.dataset.itemId)) return this.render();
    }

    static async #onDeleteItem(event, target) {
        event.preventDefault();
        const item = this.actor?.items?.get(target.dataset.itemId);
        if (!item) return;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete item" },
            content: `<p>Delete <strong>${item.name}</strong>?</p>`,
        });
        if (!ok) return;
        if (await deleteItem(this.actor, item.id)) {
            this.char.data = { ...this.char.data, itemId: null };
            this.char.pageId = "contacts";
            return this.render();
        }
    }

    static async #onOpenItem(event, target) {
        event.preventDefault();
        const item = this.actor?.items?.get(target.dataset.itemId);
        item?.sheet?.render(true);
    }

    static async #onAwardSelected(event, target) {
        event.preventDefault();
        if (!game.user.isGM) {
            ui.notifications.warn("Only a gamemaster can award session rewards.");
            return;
        }
        this.char.data = readFormData(this.char.data, this.element);
        const amounts = readAwardAmounts(target, this.char.data);
        const selected = Array.isArray(this.char.data.awardSelected) ? this.char.data.awardSelected : [];
        const party = [];
        for (const uuid of selected) {
            const doc = fromUuidSync(uuid);
            const actor = doc?.actor ?? doc;
            if (actor?.documentName === "Actor" && actor.type === "Player") party.push(actor);
        }
        if (!party.length) {
            ui.notifications.warn("Select at least one Player character on this scene.");
            return this.render();
        }
        for (const actor of party) {
            await applySessionAward(actor, amounts, { silent: true });
        }
        await reportChange({
            title: "Session awards",
            lines: [
                party.map((entry) => entry.name).join(", "),
                `+${amounts.karma} Karma each`,
                `+${amounts.nuyen.toLocaleString()}¥ each`,
                amounts.heat ? `Heat ${signed(amounts.heat)} each` : "",
                amounts.reputation ? `Reputation ${signed(amounts.reputation)} each` : "",
            ].filter(Boolean),
        });
        ui.notifications.info(`Awarded ${party.length} character${party.length === 1 ? "" : "s"}.`);
        return this.render();
    }

    #snapshot() {
        return {
            pageId: this.char.pageId,
            label: this.char.label,
            data: foundry.utils.deepClone(this.char.data),
        };
    }

    #restore(entry) {
        this.char.pageId = entry.pageId;
        this.char.label = entry.label;
        this.char.data = entry.data;
    }

    async #navigate(pageId, patch, label) {
        const data = { ...this.char.data };
        for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === "") delete data[key];
            else data[key] = value;
        }
        this.char.history.push(this.#snapshot());
        this.char.pageId = pageId;
        this.char.label = label;
        this.char.data = data;
        return this.render();
    }
}

function readPatch(target) {
    const patch = {};
    for (const key of DATA_FIELDS) {
        if (target.hasAttribute(dataAttribute(key))) patch[key] = target.dataset[key];
    }
    const clear = target.dataset.clear;
    if (clear) {
        for (const key of clear.split(",").map((part) => part.trim()).filter(Boolean)) {
            patch[key] = null;
        }
    }
    return patch;
}

function cleanLabel(target) {
    return target.querySelector?.(".sr6cw-choice-label")?.textContent?.trim() || target.textContent.trim();
}

function readFormData(data, form) {
    const patch = { ...data };
    if (!form) return patch;
    const query = form.querySelector?.("[name=compendiumQuery]")?.value;
    const specName = form.querySelector?.("[name=specName]")?.value;
    const awardKarma = form.querySelector?.("[name=awardKarma]")?.value;
    const awardNuyen = form.querySelector?.("[name=awardNuyen]")?.value;
    const awardHeat = form.querySelector?.("[name=awardHeat]")?.value;
    const awardReputation = form.querySelector?.("[name=awardReputation]")?.value;
    if (query != null) patch.query = query;
    if (specName != null) patch.specName = specName;
    if (awardKarma != null) patch.awardKarma = awardKarma;
    if (awardNuyen != null) patch.awardNuyen = awardNuyen;
    if (awardHeat != null) patch.awardHeat = awardHeat;
    if (awardReputation != null) patch.awardReputation = awardReputation;
    const awardBoxes = form.querySelectorAll?.("[name=awardActor]");
    if (awardBoxes?.length) {
        patch.awardSelected = [...awardBoxes]
            .filter((input) => input.checked)
            .map((input) => input.value);
    }
    return patch;
}

function readAwardAmounts(target, data) {
    return {
        karma: Number(target.dataset.awardKarma ?? data.awardKarma) || 0,
        nuyen: Number(target.dataset.awardNuyen ?? data.awardNuyen) || 0,
        heat: Number(target.dataset.awardHeat ?? data.awardHeat) || 0,
        reputation: Number(target.dataset.awardReputation ?? data.awardReputation) || 0,
    };
}

async function applySessionAward(actor, amounts, { silent = false } = {}) {
    await awardKarma(actor, amounts.karma);
    await awardNuyen(actor, amounts.nuyen);
    const patch = {};
    if (amounts.heat) patch["system.heat"] = (Number(actor.system.heat) || 0) + amounts.heat;
    if (amounts.reputation) {
        patch["system.reputation"] = (Number(actor.system.reputation) || 0) + amounts.reputation;
    }
    if (Object.keys(patch).length) await actor.update(patch);
    if (silent) return;
    await reportChange({
        actor,
        title: "Session award",
        lines: [
            amounts.karma ? `+${amounts.karma} Karma` : "",
            amounts.nuyen ? `+${amounts.nuyen.toLocaleString()}¥` : "",
            amounts.heat ? `Heat ${signed(amounts.heat)}` : "",
            amounts.reputation ? `Reputation ${signed(amounts.reputation)}` : "",
        ].filter(Boolean),
    });
}

function signed(value) {
    return value > 0 ? `+${value}` : String(value);
}
