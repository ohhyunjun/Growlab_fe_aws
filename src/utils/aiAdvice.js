// AI 재배 조언은 기기 전체의 환경(온도·습도·조명·양액)만 다룬다.
// 성장 속도는 포트마다 다르므로 포트별 "AI 정밀 포트 분석"에서만 다룬다.
// 예전 서버가 조언에 [성장 속도] 항목을 붙여 보내도 화면에는 내보내지 않는다.
const GROWTH_HEADING = /^\[?\s*성장 속도\s*\]?\s*[:：]?/;
const OTHER_HEADING = /^\[?\s*(환경 전반|조명 관리|양액 시스템)\s*\]?/;

export function withoutGrowthSection(adviceText) {
    if (!adviceText) return adviceText;
    const kept = [];
    let skipping = false;
    for (const line of adviceText.split("\n")) {
        const trimmed = line.trim();
        if (GROWTH_HEADING.test(trimmed)) { skipping = true; continue; }
        if (OTHER_HEADING.test(trimmed)) skipping = false;
        if (!skipping) kept.push(line);
    }
    return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
