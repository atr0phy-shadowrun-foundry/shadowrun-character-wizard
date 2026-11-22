import { availabilityOf } from "./avail.js";
import { reportChange, requestPurchaseApproval } from "./chat.js";
import { collectionFor, importFromCompendium } from "./packs.js";

export function readKarma(actor) {
    return Number(actor?.system?.karma) || 0;
}

export function readNuyen(actor) {
    return Number(actor?.system?.nuyen) || 0;
}

export function skillRank(actor, skillId) {
    const skill = actor?.system?.skills?.[skillId];
    if (!skill) return 0;
    return Number(skill.points || 0) + Number(skill.modifier || 0) + Number(skill.augment || 0);
}

export function attributeRank(actor, attrId) {
    const attr = actor?.system?.attributes?.[attrId];
    if (!attr) return null;
    if (attrId === "edg") return Number(attr.max) || 0;
    if (attr.pool != null && attr.pool !== "") return Number(attr.pool);
    return Number(attr.base || 0) + Number(attr.mod || 0);
}

/** Karma cost to raise a trait from current to current+1 (5 × new rank). */
export function costToRaise(current) {
    const next = Math.max(0, Number(current) || 0) + 1;
    return 5 * next;
}

export async function spendKarma(actor, amount, reason = "") {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can spend Karma on this character.");
        return false;
    }
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    const have = readKarma(actor);
    if (cost <= 0) return true;
    if (have < cost) {
        ui.notifications.warn(`${actor.name} has ${have} Karma; this costs ${cost}.`);
        return false;
    }
    await actor.update({ "system.karma": have - cost });
    return true;
}

export async function awardKarma(actor, amount) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only a gamemaster can award Karma.");
        return false;
    }
    const gain = Math.floor(Number(amount) || 0);
    if (!gain) return true;
    const have = readKarma(actor);
    const total = Number(actor.system.karma_total) || 0;
    await actor.update({
        "system.karma": have + gain,
        "system.karma_total": total + Math.max(0, gain),
    });
    return true;
}

export async function spendNuyen(actor, amount, reason = "") {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can spend nuyen on this character.");
        return false;
    }
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    const have = readNuyen(actor);
    if (cost <= 0) return true;
    if (have < cost) {
        ui.notifications.warn(`${actor.name} has ${have.toLocaleString()}¥; this costs ${cost.toLocaleString()}¥.`);
        return false;
    }
    await actor.update({ "system.nuyen": have - cost });
    return true;
}

export async function awardNuyen(actor, amount) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only a gamemaster can award nuyen.");
        return false;
    }
    const gain = Math.floor(Number(amount) || 0);
    if (!gain) return true;
    await actor.update({ "system.nuyen": readNuyen(actor) + gain });
    return true;
}

export async function raiseSkill(actor, skillId) {
    const skill = actor?.system?.skills?.[skillId];
    if (!skill) {
        ui.notifications.warn("That skill is not on this sheet.");
        return false;
    }
    const current = Number(skill.points) || 0;
    if (current >= 9) {
        ui.notifications.warn("Active skills top out at rank 9 in play.");
        return false;
    }
    const cost = costToRaise(current);
    if (!(await spendKarma(actor, cost, `${labelSkill(skillId)} ${current}→${current + 1}`))) return false;
    await actor.update({ [`system.skills.${skillId}.points`]: current + 1 });
    await reportChange({
        actor,
        title: "Karma — skill",
        lines: [`${labelSkill(skillId)} ${current} → ${current + 1}`, `−${cost} Karma`],
    });
    return true;
}

export async function setSpecialization(actor, skillId, name, asExpertise = false) {
    const skill = actor?.system?.skills?.[skillId];
    if (!skill) return false;
    const expanded = settingOn("expandedSpecializations");
    if (asExpertise) {
        if (!skill.specialization) {
            ui.notifications.warn("Expertise needs a specialization in that area first.");
            return false;
        }
        if (skillRank(actor, skillId) < 5) {
            ui.notifications.warn("Expertise needs skill rank 5 or higher.");
            return false;
        }
        if (!(await spendKarma(actor, 5, `Expertise: ${name || skill.specialization}`))) return false;
        const expertise = name || skill.specialization;
        await actor.update({
            [`system.skills.${skillId}.expertise`]: expertise,
        });
        await reportChange({
            actor,
            title: "Karma — expertise",
            lines: [`${labelSkill(skillId)}: ${expertise}`, "−5 Karma"],
        });
        return true;
    }
    if (skill.specialization && !expanded && !skill.expertise) {
        ui.notifications.warn("Convert the current specialization to expertise before adding another, or enable Expanded Specializations.");
        return false;
    }
    if (!(await spendKarma(actor, 5, `Specialization: ${name}`))) return false;
    if (skill.expertise && expanded) {
        const list = [...(skill.expandedSpecializations ?? [])];
        list.push(name);
        await actor.update({ [`system.skills.${skillId}.expandedSpecializations`]: list });
    } else {
        await actor.update({ [`system.skills.${skillId}.specialization`]: name });
    }
    await reportChange({
        actor,
        title: "Karma — specialization",
        lines: [`${labelSkill(skillId)}: ${name}`, "−5 Karma"],
    });
    return true;
}

export async function raiseAttribute(actor, attrId) {
    const attr = actor?.system?.attributes?.[attrId];
    if (!attr) {
        ui.notifications.warn("That attribute is not on this sheet.");
        return false;
    }
    if (attrId === "essence") {
        ui.notifications.warn("Essence changes through cyberware and bioware, not a Karma buy.");
        return false;
    }
    if (attrId === "edg") {
        // Eden Edge is { current, max } — no base like other attributes.
        const current = Number(attr.max) || 0;
        if (current >= 7) {
            ui.notifications.warn("Edge attribute tops out at 7.");
            return false;
        }
        const cost = costToRaise(current);
        if (!(await spendKarma(actor, cost, `Edge ${current}→${current + 1}`))) return false;
        await actor.update({ "system.attributes.edg.max": current + 1 });
        await reportChange({
            actor,
            title: "Karma — attribute",
            lines: [`Edge ${current} → ${current + 1}`, `−${cost} Karma`],
        });
        return true;
    }
    const current = Number(attr.base) || 0;
    if (current >= 9) {
        ui.notifications.warn("That attribute is already at the usual play ceiling.");
        return false;
    }
    const cost = costToRaise(current);
    if (!(await spendKarma(actor, cost, `${labelAttr(attrId)} ${current}→${current + 1}`))) return false;
    await actor.update({ [`system.attributes.${attrId}.base`]: current + 1 });
    await reportChange({
        actor,
        title: "Karma — attribute",
        lines: [`${labelAttr(attrId)} ${current} → ${current + 1}`, `−${cost} Karma`],
    });
    return true;
}

export async function raiseInitiation(actor) {
    const mag = actor?.system?.attributes?.mag;
    if (!mag) return false;
    const grade = Number(mag.initiation) || 0;
    const cost = 10 + grade;
    if (!(await spendKarma(actor, cost, `Initiate grade ${grade}→${grade + 1}`))) return false;
    await actor.update({ "system.attributes.mag.initiation": grade + 1 });
    await reportChange({
        actor,
        title: "Karma — initiation",
        lines: [`Initiate grade ${grade} → ${grade + 1}`, `−${cost} Karma`],
    });
    return true;
}

export async function raiseSubmersion(actor) {
    const res = actor?.system?.attributes?.res;
    if (!res) return false;
    const level = Number(res.submersion) || 0;
    const cost = 10 + level;
    if (!(await spendKarma(actor, cost, `Submersion ${level}→${level + 1}`))) return false;
    await actor.update({ "system.attributes.res.submersion": level + 1 });
    await reportChange({
        actor,
        title: "Karma — submersion",
        lines: [`Submersion ${level} → ${level + 1}`, `−${cost} Karma`],
    });
    return true;
}

export async function buyCatalogWithKarma(actor, packKey, documentId, karmaCost, label) {
    const cost = Number(karmaCost) || 0;
    if (cost > 0 && !(await spendKarma(actor, cost, label || "Catalog"))) return null;
    const created = await importFromCompendium(actor, packKey, documentId);
    if (!created) {
        if (cost > 0) await actor.update({ "system.karma": readKarma(actor) + cost });
        return null;
    }
    await reportChange({
        actor,
        title: "Karma — catalog",
        lines: [`Added ${created.name}`, cost ? `−${cost} Karma` : "No Karma charged"],
    });
    return created;
}

/** Buy off a disadvantage: 2 × listed Karma value, then delete the quality item. */
export async function removeQuality(actor, itemId) {
    const item = actor?.items?.get(itemId);
    if (!item || item.type !== "quality" || !actor.isOwner) return false;
    const listed = Number(item.system?.value) || 0;
    const cost = listed * 2;
    if (cost <= 0) {
        ui.notifications.warn(`${item.name} has no Karma value on the sheet; set system.value first.`);
        return false;
    }
    if (!(await spendKarma(actor, cost, `Buy off ${item.name}`))) return false;
    const name = item.name;
    await item.delete();
    await reportChange({
        actor,
        title: "Karma — buy off quality",
        lines: [`Removed ${name}`, `−${cost} Karma (2 × listed ${listed})`],
    });
    return true;
}

/**
 * @param {object} [options]
 * @param {string} [options.attachToUuid] Host weapon uuid for mods
 * @param {string} [options.attachToName]
 * @param {"buy"|"buy-mod"|"buy-ammo"} [options.mode]
 * @returns {Promise<Item|{{pending:true}}|null>}
 */
export async function buyCatalogWithNuyen(actor, packKey, documentId, price, label, options = {}) {
    const collection = collectionFor(packKey);
    if (!collection) {
        ui.notifications.warn("Enable shadowrun-data before adding a catalog item.");
        return null;
    }
    const document = await collection.getDocument(documentId);
    if (!document) {
        ui.notifications.warn("That catalog entry could not be loaded.");
        return null;
    }
    const cost = Number(price) || Number(document.system?.price) || 0;
    const avail = availabilityOf(document.system);
    const payload = {
        actorUuid: actor.uuid,
        actorName: actor.name,
        pack: packKey,
        documentId,
        price: cost,
        label: label || document.name,
        availLabel: avail.label,
        attachToUuid: options.attachToUuid || null,
        attachToName: options.attachToName || null,
        mode: options.mode || "buy",
    };

    if (!avail.ready && !game.user.isGM) {
        if (readNuyen(actor) < cost) {
            ui.notifications.warn(`${actor.name} has ${readNuyen(actor).toLocaleString()}¥; this costs ${cost.toLocaleString()}¥.`);
            return null;
        }
        await requestPurchaseApproval(payload);
        ui.notifications.info("Purchase posted to chat for GM approval. Nuyen is not spent yet.");
        return { pending: true };
    }

    return finalizeNuyenPurchase(actor, payload, { gmBypass: game.user.isGM && !avail.ready });
}

/** Called from chat Approve button. */
export async function completePendingPurchase(payload) {
    const doc = await fromUuid(payload.actorUuid);
    const actor = doc?.actor ?? doc;
    if (!actor || actor.documentName !== "Actor") return null;
    return finalizeNuyenPurchase(actor, payload, { fromApproval: true });
}

async function finalizeNuyenPurchase(actor, payload, meta = {}) {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can complete this purchase.");
        return null;
    }
    const cost = Number(payload.price) || 0;
    if (cost > 0 && !(await spendNuyen(actor, cost, payload.label))) return null;
    const created = await importFromCompendium(actor, payload.pack, payload.documentId);
    if (!created) {
        if (cost > 0) await actor.update({ "system.nuyen": readNuyen(actor) + cost });
        return null;
    }

    const lines = [
        `${created.name} (−${cost.toLocaleString()}¥)`,
        payload.availLabel || "",
    ];
    if (meta.gmBypass) lines.push("GM purchased a non-ready item (self-approved).");
    if (meta.fromApproval) lines.push("GM approved the Availability find.");

    if (payload.attachToUuid && created.type === "mod") {
        const host = await resolveActorItem(actor, payload.attachToUuid);
        if (host) {
            await created.update({ "system.embeddedInUuid": host.uuid });
            lines.push(`Attached to ${host.name}.`);
        }
    } else if (payload.mode === "buy-ammo" && payload.attachToName) {
        lines.push(`Bought for use with ${payload.attachToName}.`);
    }

    await reportChange({
        actor,
        title: payload.mode === "buy-mod" ? "Purchase — weapon mod"
            : payload.mode === "buy-ammo" ? "Purchase — ammunition"
                : "Purchase",
        lines: lines.filter(Boolean),
        tone: meta.fromApproval ? "ok" : "ok",
    });
    return created;
}

async function resolveActorItem(actor, uuid) {
    if (!uuid) return null;
    if (uuid.includes(actor.id) || uuid.startsWith("Actor.")) {
        const parsed = foundry.utils.parseUuid(uuid);
        return actor.items.get(parsed.id) || await fromUuid(uuid);
    }
    return actor.items.get(uuid) || await fromUuid(uuid);
}

export async function createContact(actor, { name, rating = 1, loyalty = 1, type = "" } = {}) {
    if (!actor?.isOwner) return null;
    const [created] = await actor.createEmbeddedDocuments("Item", [{
        name: name || "New contact",
        type: "contact",
        system: {
            rating: Math.max(1, Number(rating) || 1),
            loyalty: Math.max(1, Number(loyalty) || 1),
            favors: 0,
            type: type || "",
            description: "",
        },
    }]);
    await reportChange({
        actor,
        title: "Contact added",
        lines: [`${created.name} · Connection ${created.system.rating} · Loyalty ${created.system.loyalty}`],
    });
    return created;
}

export async function updateContact(actor, itemId, patch) {
    const item = actor?.items?.get(itemId);
    if (!item || item.type !== "contact" || !actor.isOwner) return false;
    const data = {};
    if (patch.rating != null) data["system.rating"] = Math.max(0, Number(patch.rating) || 0);
    if (patch.loyalty != null) data["system.loyalty"] = Math.max(0, Number(patch.loyalty) || 0);
    if (patch.name != null) data.name = String(patch.name);
    if (patch.type != null) data["system.type"] = String(patch.type);
    await item.update(data);
    await reportChange({
        actor,
        title: "Contact updated",
        lines: [`${item.name} · Connection ${item.system.rating} · Loyalty ${item.system.loyalty}`],
    });
    return true;
}

export async function createSin(actor, { name, quality = "FAKE_SIN" } = {}) {
    if (!actor?.isOwner) return null;
    const [created] = await actor.createEmbeddedDocuments("Item", [{
        name: name || "Fake SIN",
        type: "sin",
        system: {
            name: name || "Fake SIN",
            quality,
            description: "",
        },
    }]);
    await reportChange({
        actor,
        title: "SIN added",
        lines: [`${created.name} (${created.system.quality})`],
    });
    return created;
}

export async function updateSin(actor, itemId, patch) {
    const item = actor?.items?.get(itemId);
    if (!item || item.type !== "sin" || !actor.isOwner) return false;
    const data = {};
    if (patch.name != null) {
        data.name = String(patch.name);
        data["system.name"] = String(patch.name);
    }
    if (patch.quality != null) data["system.quality"] = String(patch.quality);
    await item.update(data);
    return true;
}

export async function updateLifestyle(actor, itemId, patch) {
    const item = actor?.items?.get(itemId);
    if (!item || item.type !== "lifestyle" || !actor.isOwner) return false;
    const data = {};
    if (patch.type != null) data["system.type"] = String(patch.type);
    if (patch.paid != null) data["system.paid"] = Math.max(0, Number(patch.paid) || 0);
    if (patch.cost != null) data["system.cost"] = Math.max(0, Number(patch.cost) || 0);
    await item.update(data);
    return true;
}

export async function payLifestyleMonth(actor, itemId) {
    const item = actor?.items?.get(itemId);
    if (!item || item.type !== "lifestyle") return false;
    const cost = Number(item.system.cost) || 0;
    if (!(await spendNuyen(actor, cost, `${item.name} rent`))) return false;
    const paid = (Number(item.system.paid) || 0) + 1;
    await item.update({ "system.paid": paid });
    await reportChange({
        actor,
        title: "Lifestyle rent",
        lines: [`${item.name}: paid month ${paid}`, `−${cost.toLocaleString()}¥`],
    });
    return true;
}

export async function removeAugmentation(actor, itemId) {
    const item = actor?.items?.get(itemId);
    if (!item || item.type !== "gear" || !actor.isOwner) return false;
    const essence = Number(item.system.essence) || 0;
    if (!essence) {
        ui.notifications.warn("That gear has no Essence cost; delete it from the sheet if you want it gone.");
        return false;
    }
    const name = item.name;
    await item.delete();
    await reportChange({
        actor,
        title: "Augmentation removed",
        lines: [`${name} (Essence ${essence})`, "Surgery time is a table call."],
        tone: "warn",
    });
    return true;
}

export async function installSoftware(actor, softwareId, deviceId) {
    const software = actor?.items?.get(softwareId);
    const device = actor?.items?.get(deviceId);
    if (!software || software.type !== "software" || !device || !actor.isOwner) return false;
    const slots = Number(device.system.progSlots) || 0;
    const running = actor.items.filter((entry) => (
        entry.type === "software"
        && entry.system.embeddedInUuid
        && entry.system.embeddedInUuid.includes(device.id)
    )).length;
    if (slots > 0 && running >= slots) {
        ui.notifications.warn(`${device.name} is out of program slots (${slots}).`);
        return false;
    }
    const dup = actor.items.find((entry) => (
        entry.id !== software.id
        && entry.type === "software"
        && entry.name === software.name
        && entry.system.embeddedInUuid
        && entry.system.embeddedInUuid.includes(device.id)
    ));
    if (dup) {
        ui.notifications.warn(`${device.name} already runs ${software.name}.`);
        return false;
    }
    await software.update({ "system.embeddedInUuid": device.uuid });
    await reportChange({
        actor,
        title: "Program installed",
        lines: [`${software.name} → ${device.name}`],
    });
    return true;
}

export async function uninstallSoftware(actor, softwareId) {
    const software = actor?.items?.get(softwareId);
    if (!software || software.type !== "software" || !actor.isOwner) return false;
    const name = software.name;
    await software.update({ "system.embeddedInUuid": null });
    await reportChange({
        actor,
        title: "Program uninstalled",
        lines: [`${name} removed from its device`],
    });
    return true;
}

export async function deleteItem(actor, itemId) {
    const item = actor?.items?.get(itemId);
    if (!item || !actor.isOwner) return false;
    const name = item.name;
    const type = item.type;
    await item.delete();
    await reportChange({
        actor,
        title: "Item removed",
        lines: [`${name} (${type})`],
        tone: "warn",
    });
    return true;
}

/** Attach an already-owned mod item to a weapon. */
export async function attachModToWeapon(actor, modId, weaponId) {
    const mod = actor?.items?.get(modId);
    const weapon = actor?.items?.get(weaponId);
    if (!mod || mod.type !== "mod" || !weapon || !actor.isOwner) return false;
    await mod.update({ "system.embeddedInUuid": weapon.uuid });
    await reportChange({
        actor,
        title: "Weapon mod attached",
        lines: [`${mod.name} → ${weapon.name}`],
    });
    return true;
}

export function settingOn(key) {
    try {
        return Boolean(game.settings.get("shadowrun6-eden", key));
    } catch {
        return false;
    }
}

export function labelSkill(id) {
    try {
        const key = CONFIG.SR6?.skilldefs?.[id]?.label || `skill.${id}`;
        const value = game.i18n.localize(key);
        return value === key ? id : value;
    } catch {
        return id;
    }
}

export function labelAttr(id) {
    try {
        const value = game.i18n.localize(`attrib.${id}`);
        return value.startsWith("attrib.") ? id : value;
    } catch {
        return id;
    }
}

export function isAugmentation(item) {
    if (item?.type !== "gear") return false;
    const type = String(item.system?.type || "");
    return type.includes("CYBER") || type.includes("BIOWARE") || Number(item.system?.essence) > 0 && (
        type.includes("WARE") || type.includes("IMPLANT")
    );
}

/** Program hosts only: cyberdeck, RCC (RIGGER_CONSOLE), or a commlink with progSlots. */
export function isMatrixDevice(item) {
    if (item?.type !== "gear") return false;
    const subtype = String(item.system?.subtype || "");
    if (subtype === "CYBERDECK" || subtype === "RIGGER_CONSOLE") return true;
    if (subtype === "COMMLINK") return Number(item.system?.progSlots) > 0;
    return false;
}
