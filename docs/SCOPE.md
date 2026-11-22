# Plan: `sr6-char-wizard` (character maintenance)

> Canonical copy for the workspace brain: `docs/plans/sr6-char-wizard.md`. Keep both in sync when the inventory changes.

**Status:** Module folder scaffolded at [`sr6-char-wizard/`](../) version **0.0.1**. No ApplicationV2 UI yet. This file is the living rules inventory for v1 doors. Cite printed pages; summarize in original wording; do not transcribe the PDFs.

**Purpose:** Post-run upgrades and sheet maintenance for characters that already exist in Foundry. Replaces the Commlink export/import loop for Karma spends, gear buys, contacts/SINs, cyberware, programs, session awards, and hygiene. **Not** a character-creation / priority / point-buy / life-path wizard — that stays in [`../rules/character-creation.md`](../../docs/rules/character-creation.md).

**Depends on:** system `shadowrun6-eden` 4.0.11, module `shadowrun-data`. Legal Eden documents only (no `shadowrun-import-enhancer`).

## v1 doors

| Door | Player / GM | Goal |
| --- | --- | --- |
| A. Spend Karma | Player (or GM assist) | Every Core/Companion improvement path |
| B. Contacts & SINs | Player | Add/adjust contacts, fake SINs/licenses; lifestyle if it sits here |
| C. Spend nuyen | Player | Buy from `shadowrun-data`, check loadout/skills, offer mods/ammo |
| D. Cyberware install/uninstall | Player | Essence, grade, install vs remove (distinct from buy) |
| E. Deck/RCC programs | Player | Reshuffle which programs run on which device |
| F. Session awards | GM | End-of-session Karma / nuyen (and related sheet rewards) |
| G. Sheet hygiene | Either | Call out issues; safe one-click cleanup |

Backlog (not v1): fencing/selling, full lifestyle manager, martial arts, mentor spirits, Heat/Reputation walk, downtime study clock, Karma↔nuyen conversion in play (confirm vs creation-only rates).

---

## A. Spending Karma

Primary table: Core **Character Advancement**, printed **pp. 68–69** (advancements costs + Attribute and Skill Advancement grid). Session award guidance that uses “5 Karma ≈ one step” is printed **p. 243**.

Document each row in implementation notes as: Karma formula, training time, prerequisites, Eden field, `shadowrun-data` pack if any.

| Spend | Printed | Cost / rule (summary) | Eden touch |
| --- | --- | --- | --- |
| Active skill +1 | 68–69 | `5 × new rank`; training ≈ new-rank months | Skill ranks on actor |
| New knowledge skill | 68 | 3 Karma; raise later via table | Knowledge skills |
| Knowledge skill +1 | 68–69 | `5 × new rank`; longer training (×2 months) | Knowledge skills |
| Specialization | 68, 92 | 5 Karma; ~1 month | Spec on skill |
| Expertise | 68, 92 | 5 Karma; needs that specialization and skill ≥ 5; then one extra spec allowed | Expertise on skill |
| Expanded specializations | Companion 153 | Optional: more specs without expertise-first | World setting `expandedSpecializations` |
| Attribute +1 (Physical/Mental) | 68–69 | `5 × new rank`; ~2 months | `system.attributes` |
| Edge attribute +1 | 68–69, 45 | Same grid; burned Edge buy-back separate | Edge rank |
| Burned Edge restore | 48 | Buy rank back with Karma after burning | Edge rank / points |
| Positive quality | 68, 70–79 | `2 ×` listed Karma cost; ~1 week | Item `quality` |
| Remove negative quality | 68, 70–79 | `2 ×` listed cost; ~1 week | Remove/adjust `quality` |
| New spell / ritual | 68, 130–131 | 5 Karma; learning test + time; formula/lodge | Item `spell` / `ritual` |
| New complex form | 68, 189 | 5 Karma; ~1 week | Item `complexform` |
| Initiation + metamagic | 68, 166–167 | `10 + Initiate Grade`; grade+1 months | Grade + item `metamagic` |
| Submersion + echo | 68, 195 | `10 + Submersion Level`; level+1 weeks | Level + item `echo` |
| Adept powers / PP | 156 | Post-gen power-point and power buys (confirm vs Magic) | Item `adeptpower` |
| Focus bond / craft | 151–156 | Artificing / bonding Karma and nuyen | Item `focus` |
| Contact connection/loyalty via Karma | 50–57, 237 | Confirm whether raises are Karma, nuyen, roleplay, or mix | Item `contact` |

Training concurrency (printed near the table): ~4 hours/day dedicated, up to three advancements at once if the table uses book times.

---

## B. Contacts and SINs

| Topic | Printed | Summary | Eden |
| --- | --- | --- | --- |
| Contacts (fiction + ratings) | Core ~50–57 | Connection and Loyalty as the two axes | Item `contact` (`system.rating` / loyalty fields — confirm schema) |
| Contacts at creation | 66–67 | Charisma × 6 points; neither rating above Charisma at start | Post-gen raises are freer — inventory exact play rules |
| Gaining contacts | ~237 | Running the Game / gaining contacts | New contact item |
| Contact types & favors | Companion ~160–185 | Academic…Street types; favors on top of Connection/Loyalty | Types are a Companion/Eden gap ([companion-options.md](../../docs/rules/companion-options.md)) |
| Fake SIN | Gear / ID section; SIN item use | Rating, licenses tied to the SIN | Item `sin` |
| Lifestyle | Core ~56+; Companion lifestyle qualities | Type, monthly cost, months paid | Item `lifestyle` (`type`, `cost`, `paid`) |

Crosswalk: contacts/lifestyles mostly CATALOG in Eden ([code-crosswalk.md](../../docs/rules/code-crosswalk.md), RULES-COVERAGE). Wizard writes item fields the sheet already stores; rolls (legwork) stay optional.

---

## C. Spending nuyen

| Topic | Printed | Summary | Wizard behavior |
| --- | --- | --- | --- |
| Availability | ~244 | Higher = harder to find; Matrix Search / contacts | Flag / threshold; do not silently ignore legality |
| Legality | ~244–245 | Jurisdiction-dependent codes | Warn; table call for restricted |
| Buying gear | ~246 | Pay listed cost (street vs book — confirm) | Debit actor nuyen; clone from `shadowrun-data` |
| Capacity / mods | Gear chapter | Mods consume capacity | After weapon/armor/deck buy, offer compatible mods |
| Ammunition | Weapons + ammo | Caliber / weapon match | After firearm buy, offer ammo packs |
| Vehicles / drones / RCC | Rigging + gear | Separate actors or gear | Own buy path; slaving notes |
| Programs (purchase) | ~184 | Buy then load | Hand off to door E for slotting |

**Compatibility gates to inventory with Eden fields:** weapon `system.skill`; Strength-weapon flags; datajack / cyberdeck; control rig for jump-in; Magic/Resonance for foci/forms; SIN rating vs restricted gear; wireless for wireless bonuses.

Fencing/selling: backlog unless hygiene needs “remove without refund.”

---

## D. Cyberware install / uninstall

Distinct from “buy the ware” (door C can add the item to inventory; D applies it to the body).

| Topic | Printed (to pin precisely while implementing) | Summary |
| --- | --- | --- |
| Essence cost | Cyberware/bioware chapter (Gear) | Install reduces Essence; Magic/Resonance drop with Essence |
| Grade | Same | Standard / alpha / beta / delta price and Essence multipliers |
| Uninstall / swap | Same | Freed Essence; what stays damaged or lost |
| Surgery / clinic time | If stated | Downtime clock, not a combat action |
| Eden | — | Gear subtypes cyberware/bioware; actor Essence; what recalculates automatically vs what the wizard must set |

Inventory exact printed pages from the Gear chapter when filling implementation tickets (Core outline: Gear starts printed p. 244; headware etc. later in that chapter).

---

## E. Deck / RCC program loadout

| Topic | Printed | Summary |
| --- | --- | --- |
| Programs | ~184 | What programs do; running limits |
| Persona / device | ~174–175 | ASDF from access device |
| RCC program share | Rigging ~197–198 | Data Processing caps shared autosofts; no duplicate program |
| Reshuffle | — | Change which owned programs are *running* without a new purchase |

Eden: software/program items; device program lists; confirm field names in DEVELOPER_REFERENCE / item schema before coding.

---

## F. GM session awards

| Topic | Printed | Summary |
| --- | --- | --- |
| Karma awards | ~243 | ~5 Karma as the “one improvement” unit; 1–6 typical per session |
| Cash | ~243+ | Prefer per-runner offers; redistribute at table |
| Heat / Reputation / contacts | Earlier in Running the Game | Award only if Eden stores them; otherwise note in chat |

Wizard: GM selects actors (or party), enters Karma and/or nuyen (and optional other tracked fields), writes `system.karma` / nuyen / `karma_total` if present, posts a chat summary. Spend stays on doors A–E.

---

## G. Sheet hygiene

Read-only scan + suggested fixes:

- Weapon with no skill or no fire modes enabled
- Ammo that matches no firearm on the sheet
- Mods over capacity; wireless off while a bonus expects on
- Cyberware Essence sum vs actor Essence
- Deck/RCC over program / Data Processing limit
- Contact 0/0; SIN without licenses; lifestyle with unpaid months
- Duplicate or orphan `genesisID` items if detectable

Each callout: what is wrong, book or Eden reason, one-click fix when safe (never silent destructive deletes without confirm).

---

## H. Backlog

- Fencing / selling gear for nuyen
- Full lifestyle rent + Companion lifestyle qualities manager
- Martial arts styles / techniques
- Mentor spirit take/change
- Downtime study clock / learning from contacts
- Heat / Reputation / Notoriety as its own walk
- Karma ↔ nuyen in play (creation uses 2,000¥ per Karma, or 5,000 with In Debt — confirm play allowance)
- Character creation wizard (out of scope forever for this module)

---

## Implementation phases (after this inventory)

1. **Scaffold** — done (`0.0.1`).
2. **Inventory review** — pin any remaining Gear/cyberware page numbers from the PDF; confirm Eden schemas for contact, sin, lifestyle, nuyen, karma, programs.
3. **ApplicationV2 shell** — acting character, doors A–G, cite chips like the turn wizard.
4. **Door-by-door apply** — mutate Eden fields; clone from `shadowrun-data`; never commit book prose into the module.

## Related docs

- [`../rules/character-creation.md`](../../docs/rules/character-creation.md) — gen only
- [`../rules/attributes-skills-edge.md`](../../docs/rules/attributes-skills-edge.md) — skill/spec caps
- [`../rules/companion-options.md`](../../docs/rules/companion-options.md) — expanded specs, contact types
- [`../rules/code-crosswalk.md`](../../docs/rules/code-crosswalk.md) — Eden item types
- [`../system/DEVELOPER_REFERENCE.md`](../../docs/system/DEVELOPER_REFERENCE.md) — actor/item fields
- Turn wizard pattern: [`../../sr6-turn-wizard/`](../../sr6-turn-wizard/)

