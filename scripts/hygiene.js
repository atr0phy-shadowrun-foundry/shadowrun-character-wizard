import { isMatrixDevice, skillRank } from "./apply.js";

/**
 * @returns {{ id: string, severity: "warn"|"info", title: string, detail: string, fix?: object }[]}
 */
export function scanSheet(actor) {
    if (!actor) return [];
    const issues = [];

    for (const item of actor.items.filter((entry) => entry.type === "gear")) {
        const type = String(item.system?.type || "");
        if (type.includes("WEAPON") && !item.system?.skill) {
            issues.push({
                id: `skill-${item.id}`,
                severity: "warn",
                title: `${item.name}: no skill`,
                detail: "Weapons need a skill on the item before Eden can open an attack roll.",
                fix: { action: "open-item", itemId: item.id },
            });
        }
        if (type.includes("WEAPON_FIREARMS")) {
            const modes = item.system?.modes || {};
            if (!modes.SS && !modes.SA && !modes.BF && !modes.FA) {
                issues.push({
                    id: `modes-${item.id}`,
                    severity: "info",
                    title: `${item.name}: no fire modes`,
                    detail: "All SS/SA/BF/FA boxes are off. Turn on the modes this weapon has.",
                    fix: { action: "open-item", itemId: item.id },
                });
            }
        }
    }

    const weapons = actor.items.filter((entry) => String(entry.system?.type || "").includes("WEAPON_FIREARMS"));
    for (const ammo of actor.items.filter((entry) => String(entry.system?.type || "").includes("AMMUNITION") || String(entry.system?.subtype || "").includes("AMMO"))) {
        // Soft check: ammo present with zero firearms
        if (!weapons.length) {
            issues.push({
                id: `ammo-${ammo.id}`,
                severity: "info",
                title: `${ammo.name}: no firearm on the sheet`,
                detail: "Ammunition is easier to use when a matching firearm is also on the sheet.",
            });
            break;
        }
    }

    let essenceCost = 0;
    for (const item of actor.items) {
        if (item.type === "gear" && Number(item.system?.essence)) {
            essenceCost += Number(item.system.essence) || 0;
        }
    }
    const essencePool = Number(actor.system?.attributes?.essence?.pool);
    const derived = Number(actor.system?.essence);
    if (essenceCost > 0 && Number.isFinite(essencePool) && essencePool - essenceCost < 0) {
        issues.push({
            id: "essence-over",
            severity: "warn",
            title: "Essence cost exceeds base pool",
            detail: `Augmentations total about ${essenceCost.toFixed(2)} Essence against a base of ${essencePool}.`,
        });
    }
    if (Number.isFinite(derived) && derived <= 0) {
        issues.push({
            id: "essence-zero",
            severity: "warn",
            title: "Essence at or below zero",
            detail: `Sheet Essence reads ${derived}. Confirm the ware list and grades.`,
        });
    }

    for (const device of actor.items.filter(isMatrixDevice)) {
        const slots = Number(device.system.progSlots) || 0;
        if (!slots) continue;
        const running = actor.items.filter((entry) => (
            entry.type === "software"
            && entry.system.embeddedInUuid
            && String(entry.system.embeddedInUuid).includes(device.id)
        ));
        if (running.length > slots) {
            issues.push({
                id: `prog-${device.id}`,
                severity: "warn",
                title: `${device.name}: too many programs`,
                detail: `${running.length} running, ${slots} slots. Reshuffle in the Programs door.`,
                fix: { action: "go", go: "programs" },
            });
        }
    }

    for (const contact of actor.items.filter((entry) => entry.type === "contact")) {
        if ((Number(contact.system.rating) || 0) <= 0 && (Number(contact.system.loyalty) || 0) <= 0) {
            issues.push({
                id: `contact-${contact.id}`,
                severity: "info",
                title: `${contact.name}: 0 Connection / 0 Loyalty`,
                detail: "Set Connection and Loyalty, or remove the contact.",
                fix: { action: "go", go: "contacts", itemId: contact.id },
            });
        }
    }

    for (const life of actor.items.filter((entry) => entry.type === "lifestyle")) {
        if ((Number(life.system.paid) || 0) <= 0) {
            issues.push({
                id: `life-${life.id}`,
                severity: "info",
                title: `${life.name}: no months paid`,
                detail: `Monthly cost ${Number(life.system.cost) || 0}¥. Pay a month from Contacts & SINs.`,
                fix: { action: "go", go: "contacts" },
            });
        }
    }

    for (const [id, skill] of Object.entries(actor.system?.skills || {})) {
        if ((Number(skill.points) || 0) <= 0) continue;
        if (skill.expertise && skillRank(actor, id) < 5) {
            issues.push({
                id: `exp-${id}`,
                severity: "warn",
                title: `${id}: expertise under rank 5`,
                detail: "Expertise normally needs skill rank 5+. Confirm with the table or clear the expertise.",
            });
        }
    }

    if (!issues.length) {
        issues.push({
            id: "clean",
            severity: "info",
            title: "No hygiene issues found",
            detail: "This pass looks for missing skills, fire modes, Essence, program overfill, empty contacts, and unpaid lifestyles.",
        });
    }

    return issues;
}
