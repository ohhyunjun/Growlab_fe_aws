import test from "node:test";
import assert from "node:assert/strict";
import { harvestView, isLettucePlant } from "./harvestPrediction.js";

test("new plant never receives the previous plant's forecast", () => {
    assert.equal(harvestView({id:2},{plantId:1,status:"PREDICTED"}).status,"WAITING_OBSERVATION");
});
test("dates use absolute timestamps; missed forecast is not harvest confirmation", () => {
    const p={plantId:1,status:"PREDICTED",capturedAt:"2026-10-18T00:00:00Z",expectedAt:"2026-10-18T12:00:00Z"};
    const v=harvestView({id:1},p,Date.parse("2026-10-18T13:00:00Z"));
    assert.equal(v.status,"PREDICTED");assert.equal(v.overdue,true);assert.equal(v.stale,true);
});
test("crop comes from species, not the user's nickname", () => {
    assert.equal(isLettucePlant({speciesName:"청상추"}),true);
    assert.equal(isLettucePlant({species:"적상추"}),true);
    assert.equal(isLettucePlant({name:"상추",speciesName:"딸기"}),false);
});
