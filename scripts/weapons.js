/** Heuristics for which catalog ammo fits a weapon on the sheet. */

const AMMO_NAME_RULES = [
    { re: /shotgun/i, weapon: /SHOTGUN/i },
    { re: /rifle/i, weapon: /RIFLE|SNIPER|ASSAULT_RIFLE|CARBINE/i },
    { re: /smg|submachine|heavy smg/i, weapon: /SMG|MACHINE_PISTOL/i },
    { re: /machine.?gun|lmg|mmg|hmg/i, weapon: /MACHINE_GUN|LMG|MMG|HMG/i },
    { re: /taser/i, weapon: /TASER/i },
    { re: /cannon/i, weapon: /CANNON/i },
    { re: /dart/i, weapon: /DART|INJECTION/i },
    { re: /holdout|light.?machine|light pistol|heavy pistol|pistol/i, weapon: /PISTOL|HOLDOUT|REVOLVER/i },
];

export function isWeapon(item) {
    if (!item || item.type !== "gear") return false;
    return String(item.system?.type || "").includes("WEAPON");
}

export function weaponList(actor) {
    return actor.items.filter(isWeapon).sort((a, b) => a.name.localeCompare(b.name));
}

export function modsOnWeapon(actor, weapon) {
    if (!weapon) return [];
    return actor.items.filter((item) => (
        item.type === "mod"
        && item.system?.embeddedInUuid
        && String(item.system.embeddedInUuid).includes(weapon.id)
    ));
}

/**
 * @returns {"exact"|"likely"|"other"}
 */
export function ammoRelevance(entry, weapon) {
    if (!weapon) return "other";
    const subtype = String(entry.subtype || entry.system?.subtype || "");
    const wsub = String(weapon.system?.subtype || "");
    const wtype = String(weapon.system?.type || "");
    const name = entry.name || "";

    if (subtype === "BOWS" && /BOW/i.test(wsub)) return "exact";
    if (subtype === "CROSSBOWS" && /CROSSBOW/i.test(wsub)) return "exact";
    if (subtype === "BALLISTAS" && /BALLISTA/i.test(wsub)) return "exact";
    if (["ROCKETS", "MISSILES"].includes(subtype) && /LAUNCHER|ROCKET|MISSILE/i.test(`${wtype} ${wsub}`)) return "exact";
    if (subtype === "GRENADES" && /GRENADE|LAUNCHER/i.test(`${wtype} ${wsub}`)) return "likely";

    if (subtype === "AMMUNITION" || !subtype) {
        for (const rule of AMMO_NAME_RULES) {
            if (rule.re.test(name) && rule.weapon.test(`${wsub} ${wtype} ${weapon.name}`)) return "exact";
        }
        if (/WEAPON_FIREARMS/i.test(wtype)) return "likely";
    }
    return "other";
}

export function sortAmmoForWeapon(entries, weapon) {
    const rank = { exact: 0, likely: 1, other: 2 };
    return [...entries].sort((a, b) => {
        const diff = rank[ammoRelevance(a, weapon)] - rank[ammoRelevance(b, weapon)];
        if (diff) return diff;
        return a.name.localeCompare(b.name);
    });
}
