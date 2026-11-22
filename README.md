# Shadowrun Character Wizard

Foundry module `sr6-char-wizard` version 0.1.5.

Post-generation maintenance for runners who already exist on the Eden sheet: spend Karma and nuyen after a run, update contacts and SINs, install or remove cyberware, reshuffle deck/RCC programs, let the GM award session rewards, and scan the sheet for hygiene issues. It is not a character-creation or priority wizard.

It requires:

- System `shadowrun6-eden` 4.0.11 (Foundry 13–14, verified 14.370)
- Module `shadowrun-data` (compendium catalog)
- Module `sr6-catalog` (shared item picker)

## Install

Manifest URL:

`https://raw.githubusercontent.com/atr0phy-shadowrun-foundry/shadowrun-character-wizard/main/module.json`

Enable beside Eden and `shadowrun-data`. Open from the token toolbar (amber user-gear), hotkey Shift+Alt+C, or `game.modules.get("sr6-char-wizard").api.open()`.

## v1 doors

- Spend Karma (skills, attributes, specs, initiation/submersion, qualities, spells, forms)
- Spend nuyen (catalog buy from shadowrun-data; non-ready Availability asks GM in chat first)
- Outfit a weapon (mods auto-attach; ammo for that gun)
- Contacts, SINs, lifestyle rent
- Cyberware / bioware install (buy) and uninstall
- Deck / RCC program slotting
- GM session awards (Karma / nuyen / Heat / Reputation)
- Sheet hygiene scan

Every finalized change posts a chat card for the table. Rules inventory: [`docs/SCOPE.md`](docs/SCOPE.md).
