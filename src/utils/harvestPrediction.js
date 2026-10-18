export const isLettucePlant = (plant) => /상추|lettuce/i.test(plant?.speciesName || plant?.species || "");

// A forecast is attached to a cultivation, never just a reusable port number.
export function harvestView(plant, prediction, now = Date.now()) {
    if (!plant || String(prediction?.plantId) !== String(plant.id)) return { status: "WAITING_OBSERVATION" };
    const result = { ...prediction };
    if (result.status === "PREDICTED") {
        const expected = Date.parse(result.expectedAt);
        const captured = Date.parse(result.capturedAt);
        if (!Number.isFinite(expected) || !Number.isFinite(captured)) return { status: "WAITING_OBSERVATION" };
        result.days = Math.max(0, Math.ceil((expected - now) / 86400000));
        result.overdue = expected < now;
        result.stale = Boolean(result.stale) || now - captured > 8 * 3600000;
    }
    return result;
}
