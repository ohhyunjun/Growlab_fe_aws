import test from "node:test";
import assert from "node:assert/strict";
import { withoutGrowthSection } from "./aiAdvice.js";

test("the device-wide advice never shows a growth speed section", () => {
    const advice = [
        "[환경 전반]", "온도와 습도는 적정합니다.", "",
        "[조명 관리]", "조명은 16~18시간을 유지하세요.", "",
        "[양액 시스템]", "pH가 높아 조정이 필요합니다.", "",
        "[성장 속도]", "현재 21일 경과한 생육 단계에서 정상적인 성장 속도를 보이고 있습니다.",
    ].join("\n");

    assert.equal(withoutGrowthSection(advice), [
        "[환경 전반]", "온도와 습도는 적정합니다.", "",
        "[조명 관리]", "조명은 16~18시간을 유지하세요.", "",
        "[양액 시스템]", "pH가 높아 조정이 필요합니다.",
    ].join("\n"));
});

test("a growth section in the middle or written on one line is removed too", () => {
    assert.equal(
        withoutGrowthSection("[환경 전반]\n양호합니다.\n\n[성장 속도]\n느립니다.\n계속 관찰하세요.\n\n[양액 시스템]\nTDS가 낮습니다."),
        "[환경 전반]\n양호합니다.\n\n[양액 시스템]\nTDS가 낮습니다.");
    assert.equal(withoutGrowthSection("환경 전반: 양호합니다.\n성장 속도: 정상입니다."), "환경 전반: 양호합니다.");
});

test("advice without a growth section is left as it is", () => {
    const advice = "[환경 전반]\n온도가 높습니다.\n\n[조명 관리]\n조명 시간을 줄이세요.";
    assert.equal(withoutGrowthSection(advice), advice);
    assert.equal(withoutGrowthSection(null), null);
    assert.equal(withoutGrowthSection(""), "");
});
