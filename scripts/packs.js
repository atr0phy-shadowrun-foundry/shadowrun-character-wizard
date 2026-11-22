/** Pack names from the shadowrun-data module manifest. */
export const PACKS = {
    weapons: "shadowrun-data.weapons-core-berlin-companion",
    ammunition: "shadowrun-data.ammunition-core-berlin-companion",
    armor: "shadowrun-data.armor-core-berlin-companion",
    gear: "shadowrun-data.gear-core-berlin-companion",
    augmentations: "shadowrun-data.augmentations-core-berlin-companion",
    weaponMods: "shadowrun-data.weapon-mods-core-berlin-companion",
    armorMods: "shadowrun-data.armor-mods-core-berlin-companion",
    software: "shadowrun-data.software-core-berlin-companion",
    spells: "shadowrun-data.spells-core-berlin-companion",
    rituals: "shadowrun-data.rituals-core-berlin-companion",
    forms: "shadowrun-data.complexforms-core-berlin-companion",
    adept: "shadowrun-data.adept-powers-core-berlin-companion",
    foci: "shadowrun-data.foci-core-berlin-companion",
    qualities: "shadowrun-data.qualities-normal",
    qualitiesMeta: "shadowrun-data.qualities-metagenic",
    vehicles: "shadowrun-data.vehicles-core-berlin-companion",
    drones: "shadowrun-data.drones-core-berlin-companion",
};

const PACK_LABELS = {
    weapons: "Weapons",
    ammunition: "Ammunition",
    armor: "Armor",
    gear: "Gear",
    augmentations: "Augmentations",
    weaponMods: "Weapon mods",
    armorMods: "Armor mods",
    software: "Software",
    spells: "Spells",
    rituals: "Rituals",
    forms: "Complex forms",
    adept: "Adept powers",
    foci: "Foci",
    qualities: "Qualities",
    qualitiesMeta: "Metagenic qualities",
    vehicles: "Vehicles",
    drones: "Drones",
};

const INDEX_FIELDS = [
    "system.type",
    "system.subtype",
    "system.skill",
    "system.price",
    "system.avail",
    "system.essence",
    "system.category",
    "system.drain",
    "system.fading",
    "system.value",
    "system.cost",
    "system.capacity",
    "system.progSlots",
];

export function packLabel(packKey) {
    return PACK_LABELS[packKey] || packKey;
}

export function collectionFor(packKey) {
    const id = PACKS[packKey];
    if (!id || typeof game === "undefined") return null;
    return game.packs?.get(id) ?? null;
}

export async function openPack(packKey) {
    const collection = collectionFor(packKey);
    if (!collection) {
        ui.notifications.warn("Enable the Shadowrun Compendiums module (shadowrun-data) to open that pack.");
        return null;
    }
    const open = collection.apps?.find?.((app) => app.rendered);
    if (open) return open.render({ force: true });
    const Application = collection.applicationClass
        ?? foundry.applications?.sidebar?.apps?.Compendium;
    if (!Application) {
        ui.notifications.warn("This Foundry build has no compendium window to open.");
        return null;
    }
    return new Application({ collection }).render({ force: true });
}

export async function searchPack(packKey, filter = {}) {
    const collection = collectionFor(packKey);
    if (!collection) return { missing: true, entries: [] };
    const query = (filter.query || "").trim().toLowerCase();
    if (query.length < 2) return { missing: false, entries: [], short: true };

    const index = await collection.getIndex({ fields: INDEX_FIELDS });
    const entries = [];
    for (const entry of index) {
        if (!entry.name?.toLowerCase().includes(query)) continue;
        const system = systemFromIndex(entry);
        entries.push({
            id: entry._id,
            name: entry.name,
            type: entry.type,
            hint: indexHint(system, entry.type),
            price: Number(system.price) || 0,
            avail: system.avail ?? "",
            essence: Number(system.essence) || 0,
            karma: Number(system.value) || 0,
        });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { missing: false, entries: entries.slice(0, filter.limit ?? 15), short: false };
}

export async function importFromCompendium(actor, packKey, documentId) {
    const collection = collectionFor(packKey);
    if (!collection) {
        ui.notifications.warn("Enable shadowrun-data before adding a catalog item.");
        return null;
    }
    if (!actor?.isOwner) {
        ui.notifications.warn("Only an owner of this actor can add a catalog item to the sheet.");
        return null;
    }
    const document = await collection.getDocument(documentId);
    if (!document) {
        ui.notifications.warn("That catalog entry could not be loaded.");
        return null;
    }
    const data = document.constructor.fromCompendium(document.toObject(), {
        clearFolder: true,
        clearSort: true,
        clearOwnership: true,
    });
    const [created] = await actor.createEmbeddedDocuments("Item", [data]);
    ui.notifications.info(`${created.name} was added to ${actor.name}.`);
    return created;
}

function systemFromIndex(entry) {
    if (entry.system && typeof entry.system === "object") return entry.system;
    const holder = {};
    for (const [key, value] of Object.entries(entry)) {
        if (key.startsWith("system.")) foundry.utils.setProperty(holder, key, value);
    }
    return holder.system ?? {};
}

function indexHint(system, type) {
    const bits = [];
    if (system.price != null && system.price !== "") bits.push(`${Number(system.price).toLocaleString()}¥`);
    if (system.avail != null && system.avail !== "") bits.push(`Avail ${system.avail}`);
    if (system.essence) bits.push(`Essence ${system.essence}`);
    if (type === "quality" && system.value != null) bits.push(`Karma ${system.value}`);
    if (system.skill) bits.push(String(system.skill).replaceAll("_", " "));
    if (system.type) bits.push(String(system.type).replaceAll("_", " "));
    return bits.join(" · ") || type || "Item";
}
