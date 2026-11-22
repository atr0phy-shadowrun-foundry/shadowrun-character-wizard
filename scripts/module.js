import { registerChatHooks } from "./chat.js";
import { CharWizard } from "./wizard.js";

const MODULE = "sr6-char-wizard";

Hooks.once("init", () => {
    registerChatHooks();
    game.settings.register(MODULE, "macroId", {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });

    game.keybindings.register(MODULE, "open", {
        name: "SR6CHAR.open",
        editable: [{ key: "KeyC", modifiers: ["Shift", "Alt"] }],
        onDown: () => {
            CharWizard.show();
            return true;
        },
        reservedModifiers: [],
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
});

Hooks.once("ready", async () => {
    game.modules.get(MODULE).api = {
        open(actor) {
            return CharWizard.show(actor);
        },
    };
    await ensureMacro();
    console.log(`${MODULE} | ready ${game.modules.get(MODULE)?.version ?? "?"}`);
});

Hooks.on("getSceneControlButtons", (controls) => {
    const tool = {
        name: "sr6CharWizard",
        title: "Character Wizard",
        icon: "fas fa-user-gear",
        button: true,
        order: 71,
        onClick: () => CharWizard.show(),
        onChange: () => CharWizard.show(),
    };
    if (Array.isArray(controls)) {
        const tokens = controls.find((entry) => entry.name === "token" || entry.name === "tokens");
        if (!tokens) return;
        if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
        else tokens.tools.sr6CharWizard = tool;
        return;
    }
    const tokens = controls.tokens ?? controls.token;
    if (!tokens?.tools) return;
    if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
    else tokens.tools.sr6CharWizard = tool;
});

Hooks.on("controlToken", () => {
    foundry.applications?.instances?.get?.("sr6-char-wizard")?.selectionChanged();
});

async function ensureMacro() {
    if (!game.user.isGM) return;
    try {
        const existingId = game.settings.get(MODULE, "macroId");
        if (existingId && game.macros.get(existingId)) return;
        const macro = await Macro.create({
            name: "Character Wizard",
            type: "script",
            scope: "global",
            img: "icons/svg/upgrade.svg",
            command: [
                "const mod = game.modules.get(\"sr6-char-wizard\");",
                "if (!mod?.active) return ui.notifications.error(\"Enable the Shadowrun Character Wizard module.\");",
                "return mod.api.open();",
            ].join("\n"),
        });
        await game.settings.set(MODULE, "macroId", macro.id);
    } catch (error) {
        console.error("sr6-char-wizard | could not create the hotbar macro", error);
    }
}
