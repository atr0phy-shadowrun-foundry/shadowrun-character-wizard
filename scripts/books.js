export async function openPrintedPage(bookId, printedPage) {
    const system = "shadowrun6-eden";
    let uuid = "";
    try {
        uuid = game.settings.get(system, `pdf-${bookId}-journalUuid`);
    } catch {
        uuid = "";
    }
    if (!uuid) {
        ui.notifications.warn(`Link the ${bookId} PDF in the Shadowrun 6 system settings. Printed page ${printedPage}.`);
        return;
    }
    let offset = 0;
    try {
        offset = Number(game.settings.get(system, `pdf-${bookId}-offset`)) || 0;
    } catch {
        offset = 0;
    }
    const viewerPage = Math.max(1, Number(printedPage) + 1 - offset);
    return game.sr6.utils.openPdfPage(uuid, viewerPage);
}

export function core(page) {
    return { book: "core_berlin", page, label: "Core" };
}

export function companion(page) {
    return { book: "companion", page, label: "Companion" };
}
