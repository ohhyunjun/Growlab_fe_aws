const METRICS = [
    ["온도", "minTemperature", "maxTemperature"],
    ["습도", "minHumidity", "maxHumidity"],
    ["pH", "minPh", "maxPh"],
    ["TDS", "minTds", "maxTds"],
    ["조명 시간", "minLightHours", "maxLightHours"],
];

const numeric = value => value === null || value === undefined || value === "" ? null : Number(value);

export function checkSharedEnvironment(candidate, existingPlants, speciesList) {
    const existingSpecies = [...new Set(existingPlants.map(plant => plant.speciesId))];
    if (existingSpecies.length === 0 || existingSpecies.every(id => id === candidate.id)) {
        return { compatible: true, shared: null };
    }
    const species = existingSpecies.map(id => speciesList.find(item => item.id === id));
    if (species.some(item => !item)) {
        return { compatible: false, reason: "재배 중인 품종 정보를 확인할 수 없어요." };
    }
    species.push(candidate);
    const shared = {};
    for (const [label, minKey, maxKey] of METRICS) {
        const ranges = species.map(item => [numeric(item[minKey]), numeric(item[maxKey])]);
        if (ranges.some(([min, max]) => min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max) || min > max)) {
            return { compatible: false, reason: `${label} 적정 범위가 없어 혼합 재배를 확인할 수 없어요.` };
        }
        const min = Math.max(...ranges.map(([value]) => value));
        const max = Math.min(...ranges.map(([, value]) => value));
        if (min > max) return { compatible: false, reason: `${label} 적정 범위가 겹치지 않아요.` };
        shared[minKey] = min;
        shared[maxKey] = max;
    }
    return { compatible: true, shared };
}

export function deviceSensorRanges(plants) {
    const keys = [
        ["temp", "minTemperature", "maxTemperature"],
        ["humidity", "minHumidity", "maxHumidity"],
        ["ph", "minPh", "maxPh"],
        ["tds", "minTds", "maxTds"],
    ];
    const ranges = {};
    for (const [name, minKey, maxKey] of keys) {
        const mins = plants.map(plant => numeric(plant[minKey])).filter(value => value !== null && Number.isFinite(value));
        const maxes = plants.map(plant => numeric(plant[maxKey])).filter(value => value !== null && Number.isFinite(value));
        ranges[name] = [mins.length ? Math.max(...mins) : null, maxes.length ? Math.min(...maxes) : null];
    }
    return ranges;
}

// null means the species has no usable bound, so the UI must not claim safe or unsafe.
export function sharedSensorStatus(value, [min, max]) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
    if (min === null && max === null) return null;
    const number = Number(value);
    return (min === null || number >= min) && (max === null || number <= max);
}
