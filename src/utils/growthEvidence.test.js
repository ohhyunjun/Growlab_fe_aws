import test from "node:test";
import assert from "node:assert/strict";
import { prepareGrowthTrend } from "./growthEvidence.js";

const point = day => ({ date: `2026-09-${day}`, elapsedDay: day, value: 0.02 });

test("one day and two detected ports cannot create a growth gap", () => {
    const prepared = prepareGrowthTrend({
        points: [point(28)], peerPoints: [point(28)],
        rank: 2, portCount: 2, gapPercent: -71.7, latestRatio: 0.0094,
    });
    assert.equal(prepared.observationDays, 1);
    assert.equal(prepared.trendReady, false);
    assert.equal(prepared.comparisonReady, false);
    assert.equal(prepared.gapPercent, null);
    assert.equal(prepared.rank, null);
    assert.deepEqual(prepared.peerPoints, []);
    assert.equal(prepared.latestRatio, 0.0094);
});

test("three distinct days and four comparable ports allow a comparison", () => {
    const points = [point(26), point(27), point(28)];
    const prepared = prepareGrowthTrend({
        points, peerPoints: points, rank: 2, portCount: 4, gapPercent: -9.5,
    });
    assert.equal(prepared.trendReady, true);
    assert.equal(prepared.comparisonReady, true);
    assert.equal(prepared.gapPercent, -9.5);
    assert.equal(prepared.rank, 2);
});

test("repeated photos on one day and missing comparisons stay pending", () => {
    const duplicateDay = prepareGrowthTrend({
        points: [point(28), point(28)], rank: 1, portCount: 8, gapPercent: 10,
    });
    assert.equal(duplicateDay.observationDays, 1);
    assert.equal(duplicateDay.comparisonReady, false);

    const fewPeers = prepareGrowthTrend({
        points: [point(26), point(27), point(28)], rank: 1, portCount: 2, gapPercent: 25,
    });
    assert.equal(fewPeers.trendReady, true);
    assert.equal(fewPeers.comparisonReady, false);
    assert.equal(fewPeers.gapPercent, null);
});
