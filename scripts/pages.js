import { core, companion } from "./books.js";
import {
    attributeRank,
    costToRaise,
    isAugmentation,
    isMatrixDevice,
    labelAttr,
    labelSkill,
    readKarma,
    readNuyen,
    skillRank,
} from "./apply.js";
import { availabilityOf } from "./avail.js";
import { packLabel, searchPack } from "./packs.js";
import { scanSheet } from "./hygiene.js";
import { ammoRelevance, modsOnWeapon, sortAmmoForWeapon, weaponList } from "./weapons.js";

const ATTRS = ["bod", "agi", "rea", "str", "wil", "log", "int", "cha", "edg", "mag", "res"];

export function resolveActing(state) {
    if (state.actorUuid) {
        const doc = fromUuidSync(state.actorUuid);
        const actor = doc?.actor ?? doc;
        if (actor?.documentName === "Actor") return { actor, token: null, problem: null };
    }
    const selected = canvas?.tokens?.controlled ?? [];
    if (!selected.length) return { actor: null, token: null, problem: "none" };
    const token = selected[0];
    const actor = token.actor;
    if (!actor) return { actor: null, token, problem: "broken" };
    if (!actor.isOwner && !game.user.isGM) return { actor, token, problem: "foreign" };
    return { actor, token, problem: null };
}

export async function buildPage(state) {
    const acting = resolveActing(state);
    const actor = acting.actor;
    const page = actor && !acting.problem
        ? await renderPage(state, actor)
        : noActorPage(acting);
    const actors = selectedActors().map((candidate) => ({
        uuid: candidate.uuid,
        name: candidate.name,
        current: candidate.uuid === actor?.uuid,
    }));
    return {
        ...page,
        actor,
        acting: actingCard(acting),
        actors,
        multipleActors: actors.length > 1,
        crumb: crumbTrail(state),
        purse: actor ? purseCard(actor) : null,
        isGM: game.user.isGM,
    };
}

async function renderPage(state, actor) {
    const id = state.pageId || "home";
    if (id === "karma") return karmaHub(actor);
    if (id === "karma-skills") return karmaSkills(actor);
    if (id === "karma-attrs") return karmaAttrs(actor);
    if (id === "karma-spec") return karmaSpec(actor, state.data);
    if (id === "karma-magic") return karmaMagic(actor);
    if (id === "karma-buy") return catalogBuyPage(actor, state.data, "karma");
    if (id === "karma-qualities") return karmaQualities(actor);
    if (id === "contacts") return contactsPage(actor, state.data);
    if (id === "buy") return buyHub(actor);
    if (id === "buy-search") return catalogBuyPage(actor, state.data, "nuyen");
    if (id === "weapon") return weaponHub(actor);
    if (id === "weapon-detail") return weaponDetail(actor, state.data);
    if (id === "weapon-mods") return weaponCatalog(actor, state.data, "weaponMods");
    if (id === "weapon-ammo") return weaponCatalog(actor, state.data, "ammunition");
    if (id === "cyber") return cyberPage(actor, state.data);
    if (id === "programs") return programsPage(actor, state.data);
    if (id === "awards") return awardsPage(actor, state.data);
    if (id === "hygiene") return hygienePage(actor);
    return homePage(actor);
}

function homePage(actor) {
    const karma = readKarma(actor);
    const nuyen = readNuyen(actor);
    return {
        kicker: "Character maintenance",
        title: actor.name,
        lead: "Post-run upgrades and sheet care. Spend what you earned; the wizard checks costs and prerequisites the sheet can prove.",
        leadCite: core(68),
        groups: [
            {
                heading: "Spend and buy",
                choices: [
                    choice("Spend Karma", `${karma} available. Skills, attributes, qualities, spells, initiation.`, {
                        go: "karma", badge: String(karma), cite: core(68),
                    }),
                    choice("Spend nuyen", `${nuyen.toLocaleString()}¥. Gear from shadowrun-data.`, {
                        go: "buy", badge: `${nuyen.toLocaleString()}¥`, cite: core(246),
                    }),
                    choice("Outfit a weapon", "Mods and ammo for a gun already on the sheet, with auto-attach for mods.", {
                        go: "weapon", cite: core(246),
                    }),
                    choice("Contacts & SINs", "Connection, Loyalty, fake SINs, lifestyle months.", {
                        go: "contacts", cite: core(50),
                    }),
                ],
            },
            {
                heading: "Loadout",
                choices: [
                    choice("Cyberware & bioware", "Install from the augmentations catalog, or uninstall ware on the sheet.", {
                        go: "cyber", cite: core(282),
                    }),
                    choice("Deck / RCC programs", "Slot owned software onto devices with program capacity.", {
                        go: "programs", cite: core(184),
                    }),
                ],
            },
            {
                heading: "Table tools",
                choices: [
                    ...(game.user.isGM ? [
                        choice("Session awards", "Karma, nuyen, Heat, and Reputation for runners on this scene.", {
                            go: "awards", cite: core(243),
                        }),
                    ] : []),
                    choice("Sheet hygiene", "Scan for missing skills, Essence, program overfill, empty contacts.", {
                        go: "hygiene",
                    }),
                ],
            },
        ],
        blocks: [
            block("rules", "Enforcement", [
                "Hard stops: not enough Karma or nuyen, missing skill/expertise prerequisites, program slots full, non-GM awards.",
                "Soft warnings: Availability, skill mismatch on a buy, training time from the book (the calendar is a table call).",
            ], core(68)),
        ],
    };
}

function karmaHub(actor) {
    const karma = readKarma(actor);
    return {
        kicker: "Karma",
        title: "How are you spending Karma?",
        lead: `You have ${karma} Karma. Costs use the advancement table: 5 × new rank for skills and attributes.`,
        leadCite: core(68),
        groups: [{
            choices: [
                choice("Raise a skill", "Active skills on the sheet. 5 × new rank.", { go: "karma-skills", cite: core(68) }),
                choice("Raise an attribute", "Including Edge, Magic, and Resonance bases.", { go: "karma-attrs", cite: core(69) }),
                choice("Specialization or expertise", "5 Karma. Expertise needs that specialization and rank 5+.", {
                    go: "karma-spec", cite: core(92),
                }),
                choice("Initiation / submersion", "10 + current grade or level.", { go: "karma-magic", cite: core(166) }),
                choice("Buy a quality", "2 × listed Karma cost. Search qualities-normal.", {
                    go: "karma-buy", pack: "qualities", kind: "quality", cite: core(68),
                }),
                choice("Buy off a negative quality", "2 × listed Karma cost. Removes the quality item.", {
                    go: "karma-qualities", cite: core(68),
                }),
                choice("Learn a spell", "5 Karma, then the learning time is a table call.", {
                    go: "karma-buy", pack: "spells", kind: "spell", cite: core(130),
                }),
                choice("Learn a complex form", "5 Karma.", {
                    go: "karma-buy", pack: "forms", kind: "form", cite: core(189),
                }),
                choice("Learn an adept power", "Power point cost stays on the item; Karma for new powers is a table call if your table charges it.", {
                    go: "karma-buy", pack: "adept", kind: "adept", cite: core(156),
                }),
                choice("Metamagic / echo", "After initiation or submersion, add the item on the sheet. Catalog packs for those are thin; confirm grade at the table.", {
                    disabled: true, cite: core(166),
                }),
            ],
        }],
        blocks: [
            block("rules", "Training time", [
                "The book lists months or weeks beside each advancement. Mark calendar time yourself. Up to three advancements can run in parallel at four hours a day.",
            ], core(68)),
        ],
    };
}

function karmaSkills(actor) {
    const skills = Object.keys(actor.system?.skills || {}).sort();
    const choices = skills.map((id) => {
        const current = Number(actor.system.skills[id].points) || 0;
        const cost = costToRaise(current);
        const can = readKarma(actor) >= cost && current < 9;
        return choice(
            labelSkill(id),
            current >= 9 ? "At rank 9." : `Rank ${current} → ${current + 1}. Cost ${cost} Karma.`,
            {
                action: "raise-skill",
                skill: id,
                badge: can ? `−${cost}` : "Blocked",
                dim: !can,
                cite: core(68),
            },
        );
    });
    return {
        kicker: "Karma · skills",
        title: "Raise an active skill",
        lead: "Only the points field is raised. Modifiers and augments stay as they are.",
        leadCite: core(68),
        groups: [{ choices }],
    };
}

function karmaAttrs(actor) {
    const choices = ATTRS.map((id) => {
        const current = attributeRank(actor, id);
        if (current == null) return null;
        const base = id === "edg"
            ? Number(actor.system.attributes.edg.max) || 0
            : Number(actor.system.attributes[id]?.base) || 0;
        const cost = costToRaise(base);
        const cap = id === "edg" ? 7 : 9;
        const can = readKarma(actor) >= cost && base < cap;
        return choice(
            labelAttr(id),
            `Base ${base} (pool ${current}). Cost ${cost} Karma.`,
            {
                action: "raise-attr",
                attr: id,
                badge: can ? `−${cost}` : "Blocked",
                dim: !can,
                cite: core(69),
            },
        );
    }).filter(Boolean);
    return {
        kicker: "Karma · attributes",
        title: "Raise an attribute",
        lead: "Pays for the base rank. Metatype maxima are a table check if you push past them.",
        leadCite: core(69),
        groups: [{ choices }],
    };
}

function karmaSpec(actor, data) {
    const skills = Object.entries(actor.system?.skills || {})
        .filter(([, skill]) => (Number(skill.points) || 0) > 0)
        .map(([id, skill]) => ({ id, skill }));
    if (data.skill) {
        const skill = actor.system.skills[data.skill];
        const name = data.specName || "specialty";
        return {
            kicker: labelSkill(data.skill),
            title: "Specialization or expertise",
            lead: skill.specialization
                ? `Current specialization: ${skill.specialization}.${skill.expertise ? ` Expertise: ${skill.expertise}.` : ""}`
                : "No specialization yet.",
            leadCite: core(92),
            search: {
                query: data.specName || "",
                placeholder: "Name the specialization",
                field: "specName",
            },
            groups: [{
                choices: [
                    choice("Buy specialization (5 Karma)", name, {
                        action: "buy-spec", skill: data.skill, spec: name, badge: "−5", cite: core(92),
                    }),
                    choice("Buy expertise (5 Karma)", skill.specialization || "Needs a specialization first", {
                        action: "buy-expertise", skill: data.skill, spec: name || skill.specialization,
                        badge: "−5", cite: core(92),
                        dim: !skill.specialization || skillRank(actor, data.skill) < 5,
                    }),
                ],
            }],
        };
    }
    return {
        kicker: "Karma · specialization",
        title: "Which skill?",
        lead: "Pick a ranked skill, then name the specialization.",
        leadCite: core(92),
        groups: [{
            choices: skills.map(({ id, skill }) => choice(
                labelSkill(id),
                `Rank ${skill.points}.${skill.specialization ? ` Spec: ${skill.specialization}.` : ""}`,
                { go: "karma-spec", skill: id, cite: core(92) },
            )),
        }],
    };
}

function karmaMagic(actor) {
    const mag = Number(actor.system?.attributes?.mag?.initiation) || 0;
    const res = Number(actor.system?.attributes?.res?.submersion) || 0;
    const mortype = actor.system?.mortype || "";
    const canInit = /magician|adept/i.test(mortype) || (Number(actor.system?.attributes?.mag?.base) || 0) > 0;
    const canSub = /techno/i.test(mortype) || (Number(actor.system?.attributes?.res?.base) || 0) > 0;
    const initCost = 10 + mag;
    const subCost = 10 + res;
    return {
        kicker: "Karma · initiation",
        title: "Initiation and submersion",
        lead: "After you raise the grade or level, add a metamagic or echo from the catalog (Spend Karma → buy).",
        leadCite: core(166),
        groups: [{
            choices: [
                choice(`Initiate (grade ${mag} → ${mag + 1})`, `Cost ${initCost} Karma. Then pick a metamagic.`, {
                    action: "raise-initiation", badge: `−${initCost}`, cite: core(166),
                    dim: !canInit || readKarma(actor) < initCost,
                }),
                choice(`Submerge (level ${res} → ${res + 1})`, `Cost ${subCost} Karma. Then pick an echo.`, {
                    action: "raise-submersion", badge: `−${subCost}`, cite: core(195),
                    dim: !canSub || readKarma(actor) < subCost,
                }),
            ],
        }],
    };
}

function karmaQualities(actor) {
    const negatives = actor.items.filter((item) => (
        item.type === "quality"
        && String(item.system?.category || "").toUpperCase() === "DISADVANTAGE"
    ));
    const choices = negatives.map((item) => {
        const listed = Number(item.system.value) || 0;
        const cost = listed * 2;
        const can = listed > 0 && readKarma(actor) >= cost;
        return choice(item.name, listed ? `Listed ${listed} → buy-off ${cost} Karma.` : "No Karma value on the item.", {
            action: "remove-quality",
            itemId: item.id,
            badge: can ? `−${cost}` : "Blocked",
            dim: !can,
            cite: core(68),
        });
    });
    return {
        kicker: "Karma · qualities",
        title: "Buy off a negative quality",
        lead: "Post-gen buy-off costs twice the listed Karma. Positive qualities stay; add those from Buy a quality.",
        leadCite: core(68),
        groups: [{
            choices: choices.length ? choices : [
                choice("No disadvantages on the sheet", "Nothing to buy off.", { disabled: true }),
            ],
        }],
    };
}

function contactsPage(actor, data) {
    const contacts = actor.items.filter((item) => item.type === "contact");
    const sins = actor.items.filter((item) => item.type === "sin");
    const lives = actor.items.filter((item) => item.type === "lifestyle");
    const groups = [
        {
            heading: "Contacts",
            choices: [
                ...contacts.map((item) => choice(
                    item.name,
                    `Connection ${item.system.rating} · Loyalty ${item.system.loyalty}${item.system.type ? ` · ${item.system.type}` : ""}`,
                    { go: "contacts", itemId: item.id },
                )),
                choice("Add a contact", "Starts at Connection 1 / Loyalty 1.", { action: "add-contact", cite: core(50) }),
            ],
        },
        {
            heading: "SINs",
            choices: [
                ...sins.map((item) => choice(
                    item.name,
                    item.system.quality || "SIN",
                    { go: "contacts", itemId: item.id, kind: "sin" },
                )),
                choice("Add a fake SIN", "Edit the quality rating on the item afterward if needed.", {
                    action: "add-sin", cite: core(273),
                }),
            ],
        },
        {
            heading: "Lifestyles",
            choices: lives.map((item) => choice(
                item.name,
                `${item.system.type} · ${Number(item.system.cost) || 0}¥/mo · paid ${item.system.paid}`,
                { go: "contacts", itemId: item.id, kind: "lifestyle" },
            )),
        },
    ];
    if (!lives.length) {
        groups[2].choices = [choice("No lifestyle on the sheet", "Add one from the sheet or a catalog.", { disabled: true })];
    }

    const item = data.itemId ? actor.items.get(data.itemId) : null;
    if (item?.type === "contact") {
        return {
            kicker: "Contact",
            title: item.name,
            lead: "Adjust Connection and Loyalty. Big jumps are a table call.",
            leadCite: core(50),
            groups: [{
                choices: [
                    choice("Connection +1", `Now ${item.system.rating}`, {
                        action: "contact-bump", itemId: item.id, track: "rating", delta: "1",
                    }),
                    choice("Connection −1", "", {
                        action: "contact-bump", itemId: item.id, track: "rating", delta: "-1",
                    }),
                    choice("Loyalty +1", `Now ${item.system.loyalty}`, {
                        action: "contact-bump", itemId: item.id, track: "loyalty", delta: "1",
                    }),
                    choice("Loyalty −1", "", {
                        action: "contact-bump", itemId: item.id, track: "loyalty", delta: "-1",
                    }),
                    choice("Remove contact", "Deletes the item.", {
                        action: "delete-item", itemId: item.id,
                    }),
                ],
            }],
        };
    }
    if (item?.type === "sin") {
        return {
            kicker: "SIN",
            title: item.name,
            lead: `Quality field: ${item.system.quality || "unset"}. Licenses live in the item description or linked gear until Eden grows fields.`,
            groups: [{
                choices: [
                    choice("Open item sheet", "Edit quality and description.", { action: "open-item", itemId: item.id }),
                    choice("Remove SIN", "", { action: "delete-item", itemId: item.id }),
                ],
            }],
        };
    }
    if (item?.type === "lifestyle") {
        const cost = Number(item.system.cost) || 0;
        return {
            kicker: "Lifestyle",
            title: item.name,
            lead: `${cost.toLocaleString()}¥ per month. Paid months: ${item.system.paid}.`,
            leadCite: core(56),
            groups: [{
                choices: [
                    choice("Pay one month", `Spend ${cost.toLocaleString()}¥ and increment paid.`, {
                        action: "pay-lifestyle", itemId: item.id, badge: `−${cost.toLocaleString()}¥`,
                        dim: readNuyen(actor) < cost, cite: core(56),
                    }),
                    choice("Open item sheet", "Change type or monthly cost.", { action: "open-item", itemId: item.id }),
                ],
            }],
        };
    }

    return {
        kicker: "Identity",
        title: "Contacts, SINs, lifestyles",
        lead: "Connection is who they can reach. Loyalty is what they will risk for you.",
        leadCite: core(50),
        groups,
        blocks: [
            block("rules", "Companion contact types", [
                "Academic through Street contact types and favors are Companion material. Eden stores a free-text type and a favors number; fill those on the item sheet.",
            ], companion(160)),
        ],
    };
}

function buyHub(actor) {
    return {
        kicker: "Nuyen",
        title: "What are you buying?",
        lead: `${readNuyen(actor).toLocaleString()}¥ on hand. Readily available goods debit immediately. Anything with an Availability rating posts a chat card for GM approval first.`,
        leadCite: core(246),
        groups: [{
            choices: [
                choice("Weapons", "After purchase you can outfit the new weapon with mods and ammo.", {
                    go: "buy-search", pack: "weapons", cite: core(246),
                }),
                choice("Outfit a weapon on the sheet", "Pick an owned weapon, then browse matching mods or ammo.", {
                    go: "weapon", cite: core(259),
                }),
                choice("Armor", packLabel("armor"), { go: "buy-search", pack: "armor" }),
                choice("Gear", packLabel("gear"), { go: "buy-search", pack: "gear" }),
                choice("Software", packLabel("software"), { go: "buy-search", pack: "software", cite: core(184) }),
                choice("Vehicles", packLabel("vehicles"), { go: "buy-search", pack: "vehicles" }),
                choice("Drones", packLabel("drones"), { go: "buy-search", pack: "drones" }),
                choice("Augmentations", "Prefer the Cyberware door so Essence is obvious.", {
                    go: "cyber", cite: core(282),
                }),
            ],
        }],
    };
}

function weaponHub(actor) {
    const weapons = weaponList(actor);
    return {
        kicker: "Weapons",
        title: "Which weapon?",
        lead: "Pick a weapon already on the sheet. You can buy mods (auto-attached) or ammo stocked for that piece.",
        leadCite: core(259),
        groups: [{
            choices: weapons.length ? weapons.map((item) => {
                const fitted = modsOnWeapon(actor, item).length;
                return choice(item.name, `${item.system.subtype || item.system.type || "Weapon"}${fitted ? ` · ${fitted} mod(s)` : ""}`, {
                    go: "weapon-detail", itemId: item.id, cite: core(259),
                });
            }) : [choice("No weapons on the sheet", "Buy one under Spend nuyen → Weapons.", {
                go: "buy-search", pack: "weapons",
            })],
        }],
    };
}

function weaponDetail(actor, data) {
    const weapon = actor.items.get(data.itemId);
    if (!weapon) return weaponHub(actor);
    const fitted = modsOnWeapon(actor, weapon);
    return {
        kicker: weapon.name,
        title: "Outfit this weapon",
        lead: `${weapon.system.subtype || weapon.system.type || "Weapon"}. Mods attach via Eden’s embedded link; ammo is added to the sheet for this gun.`,
        leadCite: core(259),
        groups: [
            {
                heading: "Buy for this weapon",
                choices: [
                    choice("Weapon mods", "Search catalog, pay, auto-attach to this weapon.", {
                        go: "weapon-mods", itemId: weapon.id, pack: "weaponMods", cite: core(259),
                    }),
                    choice("Ammunition", "Matching ammo sorted first; added to inventory for this weapon.", {
                        go: "weapon-ammo", itemId: weapon.id, pack: "ammunition", cite: core(250),
                    }),
                ],
            },
            {
                heading: "Already attached",
                choices: fitted.length ? fitted.map((item) => choice(
                    item.name,
                    "Installed mod",
                    { action: "open-item", itemId: item.id },
                )) : [choice("No mods attached", "", { disabled: true })],
            },
        ],
    };
}

async function weaponCatalog(actor, data, packKey) {
    const weapon = actor.items.get(data.itemId);
    if (!weapon) return weaponHub(actor);
    const query = data.query || "";
    const result = await searchPack(packKey, { query, limit: 40 });
    let entries = result.entries || [];
    const isAmmo = packKey === "ammunition";
    if (isAmmo) entries = sortAmmoForWeapon(entries, weapon);

    const choices = entries.map((entry) => {
        const avail = availabilityOf({ avail: entry.avail });
        const price = entry.price || 0;
        const can = readNuyen(actor) >= price;
        const relevance = isAmmo ? ammoRelevance(entry, weapon) : "exact";
        const hintBits = [
            entry.hint,
            !avail.ready ? "Needs GM approval" : "",
            isAmmo && relevance === "exact" ? "Likely match" : "",
            isAmmo && relevance === "other" ? "Check caliber/type" : "",
        ].filter(Boolean);
        return choice(entry.name, hintBits.join(" · "), {
            action: isAmmo ? "buy-ammo" : "buy-mod",
            pack: packKey,
            documentId: entry.id,
            itemId: weapon.id,
            price: String(price),
            badge: !avail.ready && !game.user.isGM
                ? (can ? "Ask GM" : "Blocked")
                : (can ? `−${price.toLocaleString()}¥` : "Blocked"),
            dim: !can,
        });
    });

    return {
        kicker: weapon.name,
        title: isAmmo ? "Ammunition" : "Weapon mods",
        lead: result.missing
            ? "shadowrun-data is not enabled."
            : result.short
                ? "Type at least two letters, then Apply."
                : isAmmo
                    ? "Likely matches are listed first. Ammo is added to the sheet tagged for this weapon."
                    : "Buying a mod attaches it to this weapon automatically.",
        leadCite: isAmmo ? core(250) : core(259),
        notice: "Items with an Availability rating go to chat for GM approval before nuyen is spent.",
        search: {
            query,
            placeholder: `Search ${packLabel(packKey)}`,
            pack: packKey,
        },
        groups: [{
            heading: "Catalog",
            choices: choices.length ? choices : [
                choice("No matches", "Try another query.", { disabled: true }),
            ],
        }],
    };
}

async function catalogBuyPage(actor, data, payWith) {
    const pack = data.pack || "gear";
    const query = data.query || "";
    const result = await searchPack(pack, { query });
    const currency = payWith === "karma" ? "Karma" : "¥";
    const choices = (result.entries || []).map((entry) => {
        let price = entry.price;
        if (payWith === "karma") {
            if (data.kind === "spell" || data.kind === "form") price = 5;
            else if (data.kind === "adept") price = 0;
            else if (entry.karma > 0) price = entry.karma * 2;
            else price = 5;
        }
        const avail = payWith === "nuyen" ? availabilityOf({ avail: entry.avail }) : { ready: true, label: "" };
        const can = payWith === "karma" ? readKarma(actor) >= price : readNuyen(actor) >= price;
        const hint = [
            entry.hint,
            payWith === "nuyen" && !avail.ready ? "Needs GM approval" : "",
        ].filter(Boolean).join(" · ");
        let badge = "Blocked";
        if (can) {
            if (payWith === "nuyen" && !avail.ready && !game.user.isGM) badge = "Ask GM";
            else badge = payWith === "karma" ? `−${price}` : `−${price.toLocaleString()}¥`;
        }
        return choice(entry.name, hint || entry.type, {
            action: payWith === "karma" ? "buy-karma" : "buy-nuyen",
            pack,
            documentId: entry.id,
            price: String(price),
            badge,
            dim: !can,
        });
    });
    return {
        kicker: payWith === "karma" ? "Karma · catalog" : "Nuyen · catalog",
        title: packLabel(pack),
        lead: result.missing
            ? "shadowrun-data is not enabled."
            : result.short
                ? "Type at least two letters, then Apply."
                : `${choices.length} matches.`,
        leadCite: payWith === "karma" ? core(68) : core(246),
        notice: payWith === "nuyen"
            ? "Readily available goods spend immediately. Anything with an Availability rating asks the GM in chat first."
            : "",
        search: {
            query,
            placeholder: `Search ${packLabel(pack)}`,
            pack,
        },
        groups: [{
            heading: "Results",
            choices: choices.length ? choices : [
                choice("No matches", "Try another query or open the pack.", { disabled: true }),
            ],
        }, {
            choices: [
                choice("Open full pack", "Browse in the compendium sidebar.", {
                    action: "pack", pack, badge: "Pack",
                }),
            ],
        }],
    };
}

async function cyberPage(actor, data) {
    const installed = actor.items.filter(isAugmentation);
    const query = data.query || "";
    const result = data.query ? await searchPack("augmentations", { query }) : { entries: [], short: true };
    const buyChoices = (result.entries || []).map((entry) => {
        const price = entry.price || 0;
        const can = readNuyen(actor) >= price;
        return choice(entry.name, entry.hint, {
            action: "buy-nuyen",
            pack: "augmentations",
            documentId: entry.id,
            price: String(price),
            badge: can ? `−${price.toLocaleString()}¥` : "Blocked",
            dim: !can,
            cite: core(282),
        });
    });
    return {
        kicker: "Augmentations",
        title: "Install or uninstall ware",
        lead: "Anything with Essence on the sheet counts as installed; Eden subtracts it when preparing the actor. Uninstall deletes the item.",
        leadCite: core(282),
        search: {
            query,
            placeholder: "Search augmentations to buy",
            pack: "augmentations",
        },
        groups: [
            {
                heading: "On the sheet",
                choices: installed.length ? installed.map((item) => choice(
                    item.name,
                    `Essence ${item.system.essence} · ${item.system.type || "ware"}`,
                    { action: "remove-aug", itemId: item.id, badge: "Uninstall", cite: core(282) },
                )) : [choice("No Essence ware on the sheet", "Buy below or add from the sheet.", { disabled: true })],
            },
            {
                heading: "Buy and install",
                note: "Pays nuyen, then adds the item. Grade pricing should already be on the catalog entry.",
                choices: buyChoices.length ? buyChoices : [
                    choice("Search to buy", "Type two letters and press Search.", { disabled: true }),
                ],
            },
            {
                choices: [
                    choice("Open augmentations pack", "", { action: "pack", pack: "augmentations" }),
                ],
            },
        ],
        blocks: [
            block("gap", "Surgery time", [
                "Clinic time and healing after install or removal are a table call. The wizard does not advance the calendar.",
            ]),
        ],
    };
}

function programsPage(actor, data) {
    const devices = actor.items.filter(isMatrixDevice);
    const software = actor.items.filter((item) => item.type === "software");
    const deviceId = data.itemId;
    const device = deviceId ? actor.items.get(deviceId) : null;

    if (device) {
        const slots = Number(device.system.progSlots) || 0;
        const running = software.filter((item) => item.system.embeddedInUuid && String(item.system.embeddedInUuid).includes(device.id));
        const free = software.filter((item) => !item.system.embeddedInUuid);
        return {
            kicker: device.name,
            title: "Program loadout",
            lead: slots
                ? `${running.length} / ${slots} slots in use.`
                : "This device has no progSlots value. You can still attach software; capacity is a table check.",
            leadCite: core(184),
            groups: [
                {
                    heading: "Running here",
                    choices: running.length ? running.map((item) => choice(
                        item.name,
                        "Click to unsocket",
                        { action: "uninstall-soft", itemId: item.id },
                    )) : [choice("Nothing running", "", { disabled: true })],
                },
                {
                    heading: "Owned, not slotted",
                    choices: free.length ? free.map((item) => choice(
                        item.name,
                        "Install on this device",
                        {
                            action: "install-soft",
                            itemId: item.id,
                            deviceId: device.id,
                            dim: slots > 0 && running.length >= slots,
                        },
                    )) : [choice("No free software", "Buy software from Spend nuyen.", { go: "buy-search", pack: "software" })],
                },
            ],
        };
    }

    return {
        kicker: "Programs",
        title: "Which device?",
        lead: "Pick a cyberdeck, RCC, or other gear with program slots. Buy software under Spend nuyen first if needed.",
        leadCite: core(184),
        groups: [{
            choices: devices.length ? devices.map((item) => {
                const slots = Number(item.system.progSlots) || 0;
                const running = software.filter((entry) => entry.system.embeddedInUuid && String(entry.system.embeddedInUuid).includes(item.id)).length;
                return choice(item.name, slots ? `${running}/${slots} programs` : item.system.type || "Device", {
                    go: "programs", itemId: item.id, cite: core(184),
                });
            }) : [choice("No matrix devices with slots", "Add a deck or RCC to the sheet.", { disabled: true })],
        }, {
            heading: "Loose software",
            choices: software.filter((item) => !item.system.embeddedInUuid).map((item) => choice(
                item.name,
                "Not slotted",
                { disabled: true },
            )),
        }],
    };
}

function awardsPage(actor, data) {
    if (!game.user.isGM) {
        return {
            title: "Session awards",
            notice: "Only a gamemaster can award Karma and nuyen.",
            groups: [],
        };
    }
    const scenePlayers = scenePlayerCharacters();
    const selected = resolveAwardSelection(data.awardSelected, scenePlayers);
    const karmaAmt = Number(data.awardKarma ?? 5);
    const nuyenAmt = Number(data.awardNuyen ?? 0);
    const heatAmt = Number(data.awardHeat ?? 0);
    const repAmt = Number(data.awardReputation ?? 0);
    const selectedCount = selected.length;
    return {
        kicker: "GM",
        title: "Session awards",
        lead: "Amounts apply to every checked Player character that has a token on this scene. Uncheck anyone who sat this one out.",
        leadCite: core(243),
        awardsForm: {
            karma: String(Number.isFinite(karmaAmt) ? karmaAmt : 5),
            nuyen: String(Number.isFinite(nuyenAmt) ? nuyenAmt : 0),
            heat: String(Number.isFinite(heatAmt) ? heatAmt : 0),
            reputation: String(Number.isFinite(repAmt) ? repAmt : 0),
        },
        awardRoster: scenePlayers.map((entry) => ({
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img || "icons/svg/mystery-man.svg",
            selected: selected.includes(entry.uuid),
        })),
        groups: [
            {
                heading: "Award",
                note: scenePlayers.length
                    ? "Press Apply amounts if you change the numbers, then award the checked runners."
                    : "Place Player character tokens on this scene to award them here.",
                choices: [
                    choice(
                        `Award selected (${selectedCount})`,
                        summaryAward(karmaAmt, nuyenAmt, heatAmt, repAmt),
                        {
                            action: "award-selected",
                            awardKarma: String(karmaAmt),
                            awardNuyen: String(nuyenAmt),
                            awardHeat: String(heatAmt),
                            awardReputation: String(repAmt),
                            dim: !selectedCount,
                            cite: core(243),
                        },
                    ),
                ],
            },
        ],
        blocks: [
            block("rules", "How much Karma?", [
                "1–2 for a thin session, 3–4 for real progress, 5–6 when a run wraps cleanly. More than that should be rare.",
            ], core(243)),
        ],
    };
}

/** Player actors that currently have at least one token on the active scene. */
export function scenePlayerCharacters() {
    const scene = canvas?.scene;
    if (!scene) return [];
    const tokens = scene.tokens?.contents ?? [];
    const seen = new Set();
    const list = [];
    for (const token of tokens) {
        const actor = token.actor;
        if (!actor || actor.type !== "Player") continue;
        if (seen.has(actor.uuid)) continue;
        seen.add(actor.uuid);
        list.push(actor);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveAwardSelection(stored, scenePlayers) {
    const uuids = scenePlayers.map((entry) => entry.uuid);
    // First open: everyone on the scene is checked. After that, honor the checkbox set
    // (including an empty set if the GM unchecked everyone).
    if (!Array.isArray(stored)) return uuids;
    return uuids.filter((uuid) => stored.includes(uuid));
}

function summaryAward(karma, nuyen, heat, reputation) {
    const bits = [`+${karma} Karma`, `+${Number(nuyen || 0).toLocaleString()}¥`];
    if (heat) bits.push(`Heat ${heat > 0 ? "+" : ""}${heat}`);
    if (reputation) bits.push(`Rep ${reputation > 0 ? "+" : ""}${reputation}`);
    return bits.join(", ");
}

function hygienePage(actor) {
    const issues = scanSheet(actor);
    return {
        kicker: "Hygiene",
        title: "Sheet overview",
        lead: "Advisory first. Fixes that open an item or jump to another door never silently delete rows.",
        groups: [{
            choices: issues.map((issue) => {
                const fix = issue.fix || {};
                const extra = {
                    itemId: fix.itemId,
                    badge: issue.severity === "warn" ? "Warn" : "Info",
                };
                if (fix.go) extra.go = fix.go;
                if (fix.action && fix.action !== "go") extra.action = fix.action;
                return choice(issue.title, issue.detail, extra);
            }),
        }],
    };
}

function noActorPage({ token, problem }) {
    const copy = {
        none: {
            title: "Select a character",
            lead: "Select your token on the canvas, or open the wizard from a character you own.",
        },
        broken: {
            title: "Broken token link",
            lead: `${token?.name ?? "This token"} has no actor. Relink it in token settings.`,
        },
        foreign: {
            title: "Not yours",
            lead: `You do not own ${token?.name ?? "this token"}. A GM can still open awards.`,
        },
    }[problem] || { title: "No actor", lead: "Select a token." };
    return { ...copy, groups: [], blocks: [] };
}

function selectedActors() {
    const tokens = canvas?.tokens?.controlled ?? [];
    const list = [];
    for (const token of tokens) {
        if (token.actor && (token.actor.isOwner || game.user.isGM)) list.push(token.actor);
    }
    return list;
}

function actingCard({ actor, token, problem }) {
    if (problem === "none") return null;
    if (problem === "broken") {
        return { name: token.name, img: portrait(token.document.texture?.src), note: "No actor" };
    }
    if (problem === "foreign") {
        return {
            uuid: token?.document?.uuid,
            name: token?.name,
            img: portrait(token?.document?.texture?.src, token?.actor?.img),
            note: "Not yours",
        };
    }
    return {
        uuid: token?.document?.uuid ?? actor.uuid,
        name: token?.name ?? actor.name,
        img: portrait(token?.document?.texture?.src ?? actor.prototypeToken?.texture?.src, actor.img),
    };
}

function purseCard(actor) {
    return {
        karma: readKarma(actor),
        karmaTotal: Number(actor.system.karma_total) || 0,
        nuyen: readNuyen(actor),
        heat: Number(actor.system.heat) || 0,
        reputation: Number(actor.system.reputation) || 0,
        essence: actor.system.essence ?? actor.system.attributes?.essence?.pool,
    };
}

function portrait(tokenImage, actorImage) {
    if (tokenImage && !tokenImage.includes("*")) return tokenImage;
    return actorImage || "icons/svg/mystery-man.svg";
}

function crumbTrail(state) {
    const history = state.history ?? [];
    if (state.pageId === "home") return [{ label: "Start", current: true }];
    let start = 0;
    history.forEach((entry, index) => {
        if (entry.pageId === "home") start = index;
    });
    const trail = history.slice(start).map((entry, offset) => ({
        label: entry.pageId === "home" ? "Start" : entry.label || "Start",
        index: start + offset,
    }));
    trail.push({ label: state.label || "Here", current: true });
    return trail;
}

function choice(label, hint, extra = {}) {
    return { label, hint, ...extra };
}

function block(tone, heading, paragraphs, cite) {
    return { tone, heading, paragraphs, cite, open: true };
}
