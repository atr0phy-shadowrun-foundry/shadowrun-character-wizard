/**
 * Core: goods with no Availability rating are readily available (store / Matrix order).
 * Anything with a numeric Availability (and optional legality letter) needs a find/table call.
 */

export function parseAvailability(raw) {
    if (raw == null || raw === "") return { ready: true, rating: 0, code: "", label: "Readily available" };
    const text = String(raw).trim();
    if (!text || text === "—" || text === "-" || text === "0") {
        return { ready: true, rating: 0, code: "", label: "Readily available" };
    }
    const match = text.match(/^(\d+)\s*([A-Za-z]*)$/);
    if (match) {
        const rating = Number(match[1]) || 0;
        const code = (match[2] || "").toUpperCase();
        if (rating <= 0 && !code) return { ready: true, rating: 0, code: "", label: "Readily available" };
        return {
            ready: false,
            rating,
            code,
            label: code ? `Avail ${rating}${code}` : `Avail ${rating}`,
        };
    }
    // Formula or opaque string (e.g. $RATING/3) — treat as not ready.
    return { ready: false, rating: null, code: "", label: `Avail ${text}` };
}

export function availabilityOf(system = {}) {
    const raw = system.avail ?? system.availDef ?? system.availability ?? "";
    // Prefer resolved numeric avail when availDef is a formula.
    if (system.avail != null && system.avail !== "" && !String(system.availDef || "").includes("$")) {
        return parseAvailability(system.avail);
    }
    if (system.avail != null && system.avail !== "" && Number(system.avail) > 0) {
        const fromNum = parseAvailability(system.avail);
        if (!fromNum.ready) return fromNum;
    }
    return parseAvailability(raw);
}

export function isReadilyAvailable(system) {
    return availabilityOf(system).ready;
}
