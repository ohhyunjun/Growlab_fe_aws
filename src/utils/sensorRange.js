// 서버가 내려주는 품종별 센서 범위를 화면 판정에 사용한다.
// 품종이나 일부 범위가 없을 때는 기존 화면의 기본 범위를 유지한다.
export const DEFAULT_RANGES = {
    temp: [18, 28],
    humidity: [50, 80],
    ph: [5.5, 7.0],
    tds: [200, 800],
};

const numberOr = (value, fallback) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export function resolveRanges(device) {
    const source = device || {};
    return {
        temp: [
            numberOr(source.minTemperature, DEFAULT_RANGES.temp[0]),
            numberOr(source.maxTemperature, DEFAULT_RANGES.temp[1]),
        ],
        humidity: [
            numberOr(source.minHumidity, DEFAULT_RANGES.humidity[0]),
            numberOr(source.maxHumidity, DEFAULT_RANGES.humidity[1]),
        ],
        ph: [
            numberOr(source.minPh, DEFAULT_RANGES.ph[0]),
            numberOr(source.maxPh, DEFAULT_RANGES.ph[1]),
        ],
        tds: [
            numberOr(source.minTds, DEFAULT_RANGES.tds[0]),
            numberOr(source.maxTds, DEFAULT_RANGES.tds[1]),
        ],
    };
}

export function isInRange(value, [min, max]) {
    return value !== null
        && value !== undefined
        && Number.isFinite(Number(value))
        && Number(value) >= min
        && Number(value) <= max;
}

// 적정 범위를 벗어난 거리를 범위 폭에 대한 비율로 계산해 품종 간 동일한 기준으로 채점한다.
export function scoreSensor(value, [min, max]) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return { deduct: 5, severity: null };
    }

    const numericValue = Number(value);
    if (numericValue >= min && numericValue <= max) return { deduct: 0, severity: null };

    const width = Math.max(max - min, 1e-6);
    const distance = numericValue < min ? min - numericValue : numericValue - max;
    const ratio = distance / width;

    if (ratio <= 0.15) return { deduct: 3, severity: null };
    if (ratio <= 0.35) return { deduct: 8, severity: null };
    if (ratio <= 0.6) return { deduct: 15, severity: "주의" };
    return { deduct: 25, severity: "위험" };
}
