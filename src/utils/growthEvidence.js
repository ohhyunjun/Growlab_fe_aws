// A single YOLO box is an observation, not a growth trend or a fair peer comparison.
export const MIN_TREND_DAYS = 2;
export const MIN_COMPARISON_DAYS = 3;
export const MIN_COMPARISON_PORTS = 4;

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
        observationDays,
        trendReady,
        comparisonReady,
    };
}
