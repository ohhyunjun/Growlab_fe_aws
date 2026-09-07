const ACTIVE_RUN_KEY = "growlab_monitoring_perf_active";
const RUNS_KEY = "growlab_monitoring_perf_runs";

const canUsePerformance = () =>
    typeof window !== "undefined" &&
    typeof window.performance !== "undefined" &&
    typeof window.performance.now === "function";

const readJson = (key, fallback) => {
    try {
        const value = sessionStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const writeJson = (key, value) => {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // 성능 기록 실패가 실제 화면 동작에 영향을 주지 않도록 무시한다.
    }
};

const getRun = (runId) => {
    const active = readJson(ACTIVE_RUN_KEY, null);
    if (active?.id === runId) return active;

    const runs = readJson(RUNS_KEY, []);
    return runs.find((run) => run.id === runId) ?? null;
};

const saveRun = (run) => {
    if (run.finishedAtIso) {
        const runs = readJson(RUNS_KEY, []);
        const nextRuns = [run, ...runs.filter((item) => item.id !== run.id)].slice(0, 20);
        writeJson(RUNS_KEY, nextRuns);
        return;
    }
    writeJson(ACTIVE_RUN_KEY, run);
};

const storeCompletedRun = (run) => {
    const runs = readJson(RUNS_KEY, []);
    const nextRuns = [run, ...runs.filter((item) => item.id !== run.id)].slice(0, 20);
    writeJson(RUNS_KEY, nextRuns);
    try {
        sessionStorage.removeItem(ACTIVE_RUN_KEY);
    } catch {
        // 성능 기록 실패가 실제 화면 동작에 영향을 주지 않도록 무시한다.
    }
};

export const startMonitoringPerformanceRun = (serialNumber) => {
    if (!canUsePerformance()) return null;

    const run = {
        id: `monitoring-${serialNumber}-${Date.now()}`,
        serialNumber,
        startedAt: window.performance.now(),
        startedAtIso: new Date().toISOString(),
        marks: {},
        api: {},
        notes: [],
    };

    saveRun(run);
    markMonitoringPerformance(run.id, "device_card_click");
    return run.id;
};

export const getActiveMonitoringPerformanceRun = (runId, serialNumber) => {
    const active = readJson(ACTIVE_RUN_KEY, null);
    if (runId && active?.id === runId) return active;
    if (!runId && active?.serialNumber === serialNumber) return active;
    return null;
};

export const markMonitoringPerformance = (runId, name, details = {}) => {
    if (!runId || !canUsePerformance()) return null;

    const run = getRun(runId);
    if (!run) return null;

    const elapsedMs = Math.round(window.performance.now() - run.startedAt);
    run.marks[name] = {
        elapsedMs,
        atIso: new Date().toISOString(),
        ...details,
    };
    if (name === "sensor_first_value" && run.summary) {
        run.summary.sensor_first_value_ms = elapsedMs;
    }
    saveRun(run);
    return elapsedMs;
};

export const measureMonitoringApi = async (runId, name, callback) => {
    if (!runId || !canUsePerformance()) return callback();

    const startedAt = window.performance.now();
    try {
        const result = await callback();
        const run = getRun(runId);
        if (run) {
            run.api[name] = {
                elapsedMs: Math.round(window.performance.now() - startedAt),
                ok: true,
                atIso: new Date().toISOString(),
            };
            saveRun(run);
        }
        return result;
    } catch (error) {
        const run = getRun(runId);
        if (run) {
            run.api[name] = {
                elapsedMs: Math.round(window.performance.now() - startedAt),
                ok: false,
                status: error?.response?.status ?? null,
                atIso: new Date().toISOString(),
            };
            saveRun(run);
        }
        throw error;
    }
};

export const finishMonitoringPerformanceRun = (runId, details = {}) => {
    if (!runId || !canUsePerformance()) return null;

    const run = getRun(runId);
    if (!run) return null;

    const finishedAt = Math.round(window.performance.now() - run.startedAt);
    run.finishedAtIso = new Date().toISOString();
    run.summary = {
        navigation_ms: run.marks.monitoring_route_rendered?.elapsedMs ?? null,
        core_ready_ms: run.marks.monitoring_core_visible?.elapsedMs ?? null,
        full_ready_ms: finishedAt,
        devices_api_ms: run.api.devices?.elapsedMs ?? null,
        notices_api_ms: run.api.notices?.elapsedMs ?? null,
        prediction_api_ms: run.api.prediction?.elapsedMs ?? null,
        ai_advice_api_ms: run.api.ai_advice?.elapsedMs ?? null,
        sensor_first_value_ms: run.marks.sensor_first_value?.elapsedMs ?? null,
        ...details,
    };

    storeCompletedRun(run);

    if (typeof console !== "undefined") {
        console.info("[GrowLab monitoring performance]", run.summary, run);
    }

    return run;
};

export const getMonitoringPerformanceRuns = () => readJson(RUNS_KEY, []);

if (typeof window !== "undefined") {
    window.__growlabMonitoringPerf = {
        getRuns: getMonitoringPerformanceRuns,
        getActive: () => readJson(ACTIVE_RUN_KEY, null),
    };
}
