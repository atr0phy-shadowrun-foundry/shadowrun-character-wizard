const MODULE = "sr6-char-wizard";

Hooks.once("init", () => {
    console.log(`${MODULE} | init ${game.modules.get(MODULE)?.version ?? "?"}`);
});

Hooks.once("ready", () => {
    const mod = game.modules.get(MODULE);
    if (mod) {
        mod.api = {
            /** Placeholder until the maintenance ApplicationV2 ships. */
            open() {
                ui.notifications.info("Character Wizard: scaffold only. UI comes after the rules inventory.");
            },
        };
    }
    console.log(`${MODULE} | ready`);
});
