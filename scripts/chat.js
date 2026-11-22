const MODULE = "sr6-char-wizard";

/**
 * Public chat card for every finalized wizard change.
 * @param {{ actor?: Actor, title: string, lines?: string[], tone?: "ok"|"warn"|"pending"|"deny", footer?: string }} opts
 */
export async function reportChange({ actor, title, lines = [], tone = "ok", footer = "" } = {}) {
    const who = actor?.name || "Character Wizard";
    const body = lines.filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    const content = `
        <div class="sr6cw-chat sr6cw-chat-${tone}">
            <header class="sr6cw-chat-head"><strong>${escapeHtml(title)}</strong></header>
            <p class="sr6cw-chat-who">${escapeHtml(who)}${actor ? ` · ${escapeHtml(game.user.name)}` : ""}</p>
            ${body ? `<ul class="sr6cw-chat-list">${body}</ul>` : ""}
            ${footer ? `<p class="sr6cw-chat-foot">${escapeHtml(footer)}</p>` : ""}
        </div>`;
    return ChatMessage.create({
        content,
        speaker: { alias: "Character Wizard", actor: actor?.id },
        flags: { [MODULE]: { kind: "report", tone } },
    });
}

/**
 * Ask the GM to approve a purchase that is not readily available.
 * Payload is stored on the message so Approve still works after a refresh.
 */
export async function requestPurchaseApproval(payload) {
    const requestId = foundry.utils.randomID();
    const avail = payload.availLabel || "Availability set";
    const content = `
        <div class="sr6cw-chat sr6cw-chat-pending" data-sr6cw-request="${requestId}">
            <header class="sr6cw-chat-head"><strong>Purchase needs GM approval</strong></header>
            <p class="sr6cw-chat-who">${escapeHtml(payload.actorName)} · ${escapeHtml(game.user.name)}</p>
            <ul class="sr6cw-chat-list">
                <li>${escapeHtml(payload.label)} — ${Number(payload.price || 0).toLocaleString()}¥</li>
                <li>${escapeHtml(avail)} (not readily available)</li>
                ${payload.attachToName ? `<li>Attach to ${escapeHtml(payload.attachToName)}</li>` : ""}
            </ul>
            <div class="sr6cw-chat-actions">
                <button type="button" class="sr6cw-chat-btn ok" data-sr6cw-action="approve" data-sr6cw-request="${requestId}">Approve</button>
                <button type="button" class="sr6cw-chat-btn deny" data-sr6cw-action="deny" data-sr6cw-request="${requestId}">Deny</button>
            </div>
            <p class="sr6cw-chat-foot">Nuyen is not spent until a GM approves.</p>
        </div>`;
    return ChatMessage.create({
        content,
        speaker: { alias: "Character Wizard" },
        flags: {
            [MODULE]: {
                kind: "purchase-request",
                status: "pending",
                requestId,
                payload,
            },
        },
    });
}

export function registerChatHooks() {
    const hook = foundry.utils.isNewerVersion(game.version, "12.999")
        ? "renderChatMessageHTML"
        : "renderChatMessage";
    Hooks.on(hook, (message, element) => {
        const root = element instanceof HTMLElement ? element : element?.[0] || element;
        if (!root?.querySelectorAll) return;
        for (const button of root.querySelectorAll("[data-sr6cw-action]")) {
            button.addEventListener("click", (event) => onChatAction(event, message));
        }
    });
}

async function onChatAction(event, message) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.sr6cwAction;
    const flags = message.flags?.[MODULE];
    if (!flags || flags.kind !== "purchase-request") return;
    if (flags.status !== "pending") {
        ui.notifications.warn("That purchase request was already resolved.");
        return;
    }
    if (!game.user.isGM) {
        ui.notifications.warn("Only a gamemaster can approve or deny purchases.");
        return;
    }

    if (action === "deny") {
        await message.update({
            content: stampedCard(flags.payload, "deny", `Denied by ${game.user.name}.`),
            flags: { [MODULE]: { ...flags, status: "denied", by: game.user.id } },
        });
        await reportChange({
            actor: await fromUuid(flags.payload.actorUuid),
            title: "Purchase denied",
            lines: [`${flags.payload.label} (${flags.payload.availLabel})`],
            tone: "deny",
        });
        return;
    }

    if (action !== "approve") return;
    const { completePendingPurchase } = await import("./apply.js");
    const result = await completePendingPurchase(flags.payload);
    if (!result) {
        ui.notifications.warn("Could not complete that purchase (nuyen, actor, or catalog missing).");
        return;
    }
    await message.update({
        content: stampedCard(flags.payload, "ok", `Approved by ${game.user.name}.`),
        flags: { [MODULE]: { ...flags, status: "approved", by: game.user.id } },
    });
}

function stampedCard(payload, tone, footer) {
    return `
        <div class="sr6cw-chat sr6cw-chat-${tone}">
            <header class="sr6cw-chat-head"><strong>Purchase ${tone === "ok" ? "approved" : "denied"}</strong></header>
            <p class="sr6cw-chat-who">${escapeHtml(payload.actorName)}</p>
            <ul class="sr6cw-chat-list">
                <li>${escapeHtml(payload.label)} — ${Number(payload.price || 0).toLocaleString()}¥</li>
                <li>${escapeHtml(payload.availLabel || "")}</li>
            </ul>
            <p class="sr6cw-chat-foot">${escapeHtml(footer)}</p>
        </div>`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
