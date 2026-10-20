// A single YOLO box is an observation, not a growth trend or a fair peer comparison.
export const MIN_TREND_DAYS = 2;
export const MIN_COMPARISON_DAYS = 3;
export const MIN_COMPARISON_PORTS = 2;
export const MIN_HEALTH_REFERENCE_PLANTS = 1;

const RATE_STATUSES = new Set(["growing", "flat", "down"]);

// 이 포트의 최근 성장 속도. 화면에 따로 내세우지 않고 다른 재배와 견줄 때만 쓴다.
// 서버가 관측 부족으로 판단했거나 형식이 어긋나면 대기로 둔다.
function prepareGrowthRate(rate) {
    const ready = RATE_STATUSES.has(rate?.status) && Number.isFinite(rate?.ratePerDay);
    return {
        ready,
        status: ready ? rate.status : "pending",
        ratePerDay: ready ? rate.ratePerDay : null,
        previousRatePerDay: ready && Number.isFinite(rate.previousRatePerDay) ? rate.previousRatePerDay : null,
        observationDays: ready ? rate.observationDays ?? null : null,
        spanDays: ready ? rate.spanDays ?? null : null,
    };
}

// 이 포트가 며칠 전보다 얼마나 커졌는지. 크기는 같은 포트의 과거와만 견준다.
function prepareSizeChange(change) {
    const ready = change?.ready === true && Number.isFinite(change.changePercent) && Number.isFinite(change.days);
    return ready
        ? { ready: true, days: change.days, changePercent: change.changePercent,
            lowerBound: change.lowerBound === true }
        : { ready: false, days: null, changePercent: null, lowerBound: false };
}

// 박스 면적은 사진마다 흔들리므로 이 안쪽의 변화는 '비슷'으로 본다.
export const SAME_SIZE_BAND_PERCENT = 3;

// 화면에 쓰는 과거 대비 크기 문구. 소수점 없이 '약'으로 보여준다.
export function describeSizeChange(change) {
    if (!change?.ready) return "관측 대기";
    const rounded = Math.round(change.changePercent);
    if (change.lowerBound) return `${change.days}일 전보다 최소 +${rounded}%`;
    if (Math.abs(rounded) < SAME_SIZE_BAND_PERCENT) return `${change.days}일 전과 비슷`;
    return `${change.days}일 전보다 약 ${rounded > 0 ? "+" : ""}${rounded}%`;
}

// 크기는 포트가 화면에 어떻게 찍히느냐에 달려 있어 포트끼리 견주지 않는다. 포트끼리는 속도만 견준다:
// 같은 품종의 다른 재배 기록이 심은 뒤 같은 시기에 보인 하루 성장률과의 비교.
const VERDICT_LABEL = { faster: "더 빠름", similar: "비슷함", slower: "더 느림" };

function prepareReference(reference) {
    const ready = reference?.ready === true && reference.verdict in VERDICT_LABEL
        && Number.isFinite(reference.ratePerDay);
    if (!ready) return { ready: false, verdict: null, ratePerDay: null, plantCount: null, portIndices: [] };
    return {
        ready: true,
        verdict: reference.verdict,
        ratePerDay: reference.ratePerDay,
        plantCount: reference.plantCount ?? null,
        portIndices: Array.isArray(reference.portIndices)
            ? reference.portIndices.filter(index => Number.isInteger(index) && index >= 0) : [],
    };
}

// 포트 상태 판정에 쓰는 비교 결과. behind: 같은 시기의 다른 재배보다 뚜렷이 느리게 자란다.
export function growthComparison(trend) {
    const verdict = trend?.reference?.ready
        && Number(trend.reference.plantCount) >= MIN_HEALTH_REFERENCE_PLANTS
        ? trend.reference.verdict : null;
    return { verdict, behind: verdict === "slower" };
}

// 화면에는 같은 품종·경과일의 성장 속도 비교 결과만 간결하게 보여준다.
export function describeComparison(reference) {
    if (!reference?.ready) return "비교 대기";
    return VERDICT_LABEL[reference.verdict];
}

export function currentSizeRatio(trend) {
    if (trend?.measurement === "box_green" && Number.isFinite(trend.latestRatio)) {
        return trend.latestRatio;
    }
    const box = trend?.latestBoxRatio;
    const green = trend?.latestGreenRatio;
    if (!Number.isFinite(box) || box <= 0 || box > 1
        || !Number.isFinite(green) || green <= 0 || green > box + 0.01) return null;
    return box ** 0.7 * green ** 0.3;
}

export function prepareGrowthTrend(trend) {
    if (!trend) return null;

    const points = Array.isArray(trend.points) ? trend.points : [];
    const observationDays = new Set(points
        .filter(point => Number.isFinite(point?.value))
        .map(point => point.elapsedDay ?? point.date)
        .filter(day => day != null)).size;
    const trendReady = observationDays >= MIN_TREND_DAYS;
    const comparisonReady = observationDays >= MIN_COMPARISON_DAYS
        && Number(trend.portCount) >= MIN_COMPARISON_PORTS
        && Number.isFinite(trend.gapPercent)
        && Number.isFinite(trend.rank);

    return {
        ...trend,
        points,
        peerPoints: comparisonReady && Array.isArray(trend.peerPoints) ? trend.peerPoints : [],
        rank: comparisonReady ? trend.rank : null,
        portCount: comparisonReady ? trend.portCount : null,
        gapPercent: comparisonReady ? trend.gapPercent : null,
        sizeChange: prepareSizeChange(trend.sizeChange),
        growthRate: prepareGrowthRate(trend.growthRate),
        reference: prepareReference(trend.reference),
        // 포트를 옮겨 화면에 찍히는 자리가 마지막으로 바뀐 경과일. 크기와 속도는 그 뒤 사진끼리만 견준다.
        viewChangedDay: Number.isFinite(trend.viewChangedDay) ? trend.viewChangedDay : null,
        measurement: trend.measurement === "box_green" ? "box_green" : "box",
        latestBoxRatio: Number.isFinite(trend.latestBoxRatio) ? trend.latestBoxRatio : trend.latestRatio ?? null,
        latestGreenRatio: Number.isFinite(trend.latestGreenRatio) ? trend.latestGreenRatio : null,
        latestLowerBound: trend.latestLowerBound === true,
        observationDays,
        trendReady,
        comparisonReady,
    };
}
