import test from "node:test";
import assert from "node:assert/strict";
import { checkSharedEnvironment, deviceSensorRanges, sharedSensorStatus } from "./sharedEnvironment.js";

const strawberry = { id: 1, minTemperature: 18, maxTemperature: 26,
    minHumidity: 50, maxHumidity: 80, minPh: 5.5, maxPh: 6.5,
    minTds: 300, maxTds: 800, minLightHours: 8, maxLightHours: 14 };
const lettuce = { id: 2, minTemperature: 15, maxTemperature: 22,
    minHumidity: 60, maxHumidity: 75, minPh: 5.8, maxPh: 7,
    minTds: 400, maxTds: 900, minLightHours: 10, maxLightHours: 16 };

test("mixed species use the full shared intersection", () => {
    const result = checkSharedEnvironment(lettuce, [{ speciesId: 1 }], [strawberry, lettuce]);
    assert.equal(result.compatible, true);
    assert.equal(result.shared.minTemperature, 18);
    assert.equal(result.shared.maxTemperature, 22);
    assert.equal(result.shared.minLightHours, 10);
    assert.equal(result.shared.maxLightHours, 14);
});

test("missing bounds prevent mixed species, while same species remains possible", () => {
    const partial = { ...lettuce, maxPh: null };
    assert.equal(checkSharedEnvironment(partial, [{ speciesId: 1 }], [strawberry, partial]).compatible, false);
    assert.equal(checkSharedEnvironment(partial, [{ speciesId: 2 }], [partial]).compatible, true);
});

test("a conflict in light duration also prevents mixed species", () => {
    const dark = { ...lettuce, minLightHours: 15 };
    assert.equal(checkSharedEnvironment(dark, [{ speciesId: 1 }], [strawberry, dark]).compatible, false);
});

test("device sensor display uses all planted species", () => {
    assert.deepEqual(deviceSensorRanges([strawberry, lettuce]).temp, [18, 22]);
    assert.deepEqual(deviceSensorRanges([strawberry, lettuce]).humidity, [60, 75]);
});

test("missing bounds do not create a false sensor warning", () => {
    assert.equal(sharedSensorStatus(23, [null, null]), null);
    assert.equal(sharedSensorStatus(23, [18, 22]), false);
    assert.equal(sharedSensorStatus(20, [18, 22]), true);
});
