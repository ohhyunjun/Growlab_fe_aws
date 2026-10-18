import test from "node:test";
import assert from "node:assert/strict";
import { prepareGrowthTrend, growthComparison, describeSizeChange, describeComparison } from "./growthEvidence.js";

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

test("a lone port still reports its own growth rate", () => {
    const prepared = prepareGrowthTrend({
        points: [point(26), point(27), point(28)],
        growthRate: { ratePerDay: 10, previousRatePerDay: null, status: "growing", observationDays: 3, spanDays: 2 },
    });
    assert.equal(prepared.growthRate.ready, true);
    assert.equal(prepared.growthRate.ratePerDay, 10);
    assert.equal(prepared.reference.ready, false);
    assert.deepEqual(growthComparison(prepared), { verdict: null, behind: false });

    const pending = prepareGrowthTrend({ points: [point(28)], growthRate: { status: "pending", ratePerDay: null } });
    assert.equal(pending.growthRate.ready, false);
    assert.equal(pending.growthRate.status, "pending");
    assert.equal(prepareGrowthTrend({ points: [point(28)] }).growthRate.ready, false);
});

test("ports are compared by growth speed at the same age, not by size", () => {
    const slower = prepareGrowthTrend({
        points: [point(26), point(27), point(28)], latestRatio: 0.30, rank: 1, portCount: 4, gapPercent: 40,
        reference: { ready: true, ratePerDay: 15, lowRatePerDay: 14.5, highRatePerDay: 15.5, plantCount: 3, verdict: "slower" },
    });
    // bigger than its peers, yet growing more slowly than they did at this age
    assert.deepEqual(growthComparison(slower), { verdict: "slower", behind: true });
    assert.equal(describeComparison(slower.reference), "더 느림");

    const similar = prepareGrowthTrend({
        points: [point(28)], latestRatio: 0.01,
        reference: { ready: true, ratePerDay: 9.6, plantCount: 3, verdict: "similar" },
    });
    assert.deepEqual(growthComparison(similar), { verdict: "similar", behind: false });
    const withOwnRate = prepareGrowthTrend({
        points: [point(28)],
        growthRate: { ratePerDay: 10.6, status: "growing", observationDays: 5, spanDays: 4 },
        reference: { ready: true, ratePerDay: 9.6, plantCount: 3, verdict: "similar" },
    });
    assert.equal(describeComparison(withOwnRate.reference), "비슷함");
});

test("a size gap alone never marks a port as behind", () => {
    const points = [point(26), point(27), point(28)];
    const sizeOnly = prepareGrowthTrend({ points, peerPoints: points, rank: 4, portCount: 4, gapPercent: -40 });
    assert.equal(sizeOnly.reference.ready, false);
    assert.deepEqual(growthComparison(sizeOnly), { verdict: null, behind: false });
    assert.equal(describeComparison(sizeOnly.reference), "비교 대기");

    const unknownVerdict = prepareGrowthTrend({ points, reference: { ready: true, ratePerDay: 10, verdict: "ahead" } });
    assert.equal(unknownVerdict.reference.ready, false);
});

test("a port move is passed through so the UI can explain the rate", () => {
    const moved = prepareGrowthTrend({ points: [point(26), point(27), point(28)], viewChangedDay: 16 });
    assert.equal(moved.viewChangedDay, 16);
    assert.equal(prepareGrowthTrend({ points: [point(28)] }).viewChangedDay, null);
    // a status the UI does not know is treated as pending, not shown raw
    const unknown = prepareGrowthTrend({ points: [point(28)], growthRate: { status: "slowing", ratePerDay: 3 } });
    assert.equal(unknown.growthRate.ready, false);
});

test("a port is compared with its own past by size", () => {
    const change = (days, changePercent) =>
        prepareGrowthTrend({ points: [point(28)], sizeChange: { ready: true, days, fromRatio: 0.1, toRatio: 0.1, changePercent } }).sizeChange;

    assert.equal(describeSizeChange(change(4, 35.7)), "4일 전보다 약 +36%");
    assert.equal(describeSizeChange(change(3, -12.2)), "3일 전보다 약 -12%");
    assert.equal(describeSizeChange(change(2, 1.4)), "2일 전과 비슷");
    assert.equal(describeSizeChange(prepareGrowthTrend({ points: [point(28)], sizeChange: { ready: false } }).sizeChange), "관측 대기");
    assert.equal(describeSizeChange(prepareGrowthTrend({ points: [point(28)] }).sizeChange), "관측 대기");
    assert.equal(describeSizeChange(undefined), "관측 대기");
});
