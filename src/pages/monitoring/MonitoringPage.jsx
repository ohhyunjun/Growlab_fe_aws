import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { getUserDevicesApi, updateLedApi, updatePhotoIntervalApi } from "../../api/deviceApi";
import { getAllNoticesApi } from "../../api/noticeApi";
import { getLatestSensorApi } from "../../api/sensorApi";
import { API_BASE } from "../../api/config";
import { getLatestHarvestPredictionApi } from "../../api/predictionApi";
import HarvestReadout from "../../components/HarvestReadout";
import { isLettucePlant } from "../../utils/harvestPrediction";
import { getGrowthTrendApi } from "../../api/photoApi";
import {
    finishMonitoringPerformanceRun,
    getActiveMonitoringPerformanceRun,
    markMonitoringPerformance,
    measureMonitoringApi,
} from "../../utils/monitoringPerformance";
import { resolveRanges, scoreSensor } from "../../utils/sensorRange";
import { deviceSensorRanges, sharedSensorStatus } from "../../utils/sharedEnvironment";
import { prepareGrowthTrend, growthComparison, describeSizeChange, describeComparison, currentSizeRatio, SAME_SIZE_BAND_PERCENT } from "../../utils/growthEvidence";
import { withoutGrowthSection } from "../../utils/aiAdvice";

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const getSensorKey = (serial) => `growlab_sensor_${serial}`;
const getNoticeKey = (serial) => `growlab_notices_${serial}`;
const emptySensorData = () => ({
    temperature: null, humidity: null, ph: null, tds: null, water_level_status: null,
});

// ── AI 조언 API 호출 ──────────────────────────────────────────
const fetchAiData = async (deviceData, plantData, liveSensor) => {
    try {
        const token = localStorage.getItem("token");
        const daysSincePlanted = plantData?.plantedAt
            ? Math.floor((new Date() - new Date(plantData.plantedAt)) / (1000 * 60 * 60 * 24))
            : null;
        const response = await fetch(`${API_BASE}/ai/advice`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                serialNumber: deviceData.serialNumber,
                speciesId: plantData?.speciesId ?? null,
                speciesName: plantData?.species || plantData?.speciesName || null,
                temperature: liveSensor?.temperature ?? deviceData.temperature,
                humidity: liveSensor?.humidity ?? deviceData.humidity,
                ph: liveSensor?.ph ?? deviceData.ph,
                ec: liveSensor?.tds ?? deviceData.ec,
                waterLevel: liveSensor?.water_level_status ?? deviceData.waterLevel,
                daysSincePlanted,
                plantStage: plantData?.stageName || plantData?.plantStage || null,
            })
        });
        const data = await response.json();
        return withoutGrowthSection(data.advice) || null;
    } catch {
        return null;
    }
};

// ── Vision AI 분석 점수 계산 (센서 데이터 기반) ───────────────
const calcVisionScore = (sensorData, ranges) => {
    const { temperature, humidity, ph, tds, water_level_status } = sensorData;
    const activeRanges = ranges || resolveRanges(null);

    const validCount = [
        temperature,
        humidity,
        ph,
        tds,
        water_level_status
    ].filter(v => v !== null).length;

    if (validCount === 0) {
        return {
            score: 0,
            grade: "-",
            growthStatus: "분석 대기",
            diseaseRisk: "-",
            issues: []
        };
    }

    let score = 100;
    const issues = [];

    const applySensorScore = (value, range, label) => {
        if (range[0] === null || range[1] === null) return;
        const { deduct, severity } = scoreSensor(value, range);
        score -= deduct;
        if (severity) issues.push(`${label} ${severity}`);
    };

    applySensorScore(temperature, activeRanges.temp, "온도");
    applySensorScore(humidity, activeRanges.humidity, "습도");
    applySensorScore(ph, activeRanges.ph, "pH");
    applySensorScore(tds, activeRanges.tds, "양액");

    // ===== 수위 =====
    if (water_level_status === false) {
        score -= 15;
        issues.push("수위 부족");
    } else if (water_level_status === null) {
        score -= 3;
    }

    score = Math.max(0, Math.round(score));

    const growthStatus =
        score >= 85 ? "정상" :
        score >= 65 ? "주의" :
        "위험";

    const diseaseRisk =
        issues.some(i => i.includes("위험")) ? "높음" :
        issues.length >= 2 ? "보통" :
        "낮음";

    const grade =
        score >= 95 ? "S" :
        score >= 85 ? "A" :
        score >= 75 ? "B" :
        score >= 65 ? "C" :
        "D";

    return {
        score,
        grade,
        growthStatus,
        diseaseRisk,
        issues,
    };
};

// 기기 공통 센서 점수에 확인된 질병과, 같은 시기 다른 재배와 견준 성장 속도만 반영한다.
// 사진에서 식물을 못 찾았더라도 센서 상태는 별도로 보여준다.
const calcPortHealth = (base, plant, trend) => {
    if (!plant) return { portDataAvailable: false, reason: "no_plant" };
    if (base.grade === "-") return { portDataAvailable: false, reason: "no_sensor" };
    const diseased = isDiseased(plant.diseaseResult);
    const { verdict, behind } = growthComparison(trend);

    let score = base.score;
    const issues = [...(base.issues || [])];
    if (diseased) { score -= 35; issues.unshift(`질병 의심(${plant.diseaseResult})`); }
    // 환경이 좋아도 같은 시기의 다른 재배보다 뚜렷이 느리면 점수에 반영한다.
    if (behind) { score -= 15; issues.unshift("같은 시기의 다른 재배보다 느린 성장"); }
    else if (verdict === "faster") { score += 3; }
    score = Math.max(0, Math.min(100, Math.round(score)));

    const grade = score >= 95 ? "S" : score >= 85 ? "A" : score >= 75 ? "B" : score >= 65 ? "C" : "D";
    let growthStatus = score >= 85 ? "정상" : score >= 65 ? "주의" : "위험";
    if ((diseased || behind) && growthStatus === "정상") growthStatus = "주의";
    const diseaseRisk = diseased ? "높음" : behind ? "보통" : base.diseaseRisk;

    return { portDataAvailable: true, score, grade, growthStatus, diseaseRisk, issues };
};

function EmptyTimeline({ children }) {
    return (
        <div className="min-h-44 rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 flex items-center justify-center px-4 text-center text-body2 text-gray-500">
            {children}
        </div>
    );
}

// ── 확장 기능 공통 헬퍼 ───────────────────────────────────────
// 질병 라벨 판정 (BE isHealthyLabel과 동일: healthy/normal/정상/no_detection은 정상으로 본다)
const HEALTHY_LABELS = new Set(["", "no_detection", "healthy", "normal", "정상"]);
const isDiseased = (label) => {
    if (label == null) return false;
    return !HEALTHY_LABELS.has(String(label).trim().toLowerCase());
};

const HEALTH_COLOR = { good: "#66A368", warn: "#f59e0b", bad: "#ef4444", pending: "#A3A3A3", empty: "#D4D4D4" };

// 서버가 한 번의 성장 추이 응답으로 계산한 전체 포트의 크기·속도 상태를 표시한다.
const resolvePortHealth = (plant, serverHealth) => {
    if (!plant) return "empty";
    if (isDiseased(plant.diseaseResult)) return "bad";
    return ["good", "warn", "bad", "pending"].includes(serverHealth) ? serverHealth : "pending";
};
// 관측된 생육 단계는 그대로 표시하지만, 날짜 예측은 수확기에만 제공한다.
function HarvestForecastSection({ selectedPlant, prediction }) {
    if (!selectedPlant) return <EmptyTimeline>이 포트에 식물이 없어요</EmptyTimeline>;
    if (!isLettucePlant(selectedPlant)) {
        return (
            <section className="rounded-xl bg-gray-50 p-4" aria-label="수확기 예상">
                <h3 className="text-caption font-bold text-gray-500">수확기 예상</h3>
                <p className="mt-2 text-body2 text-gray-600">이 품종의 수확기 예측 모델은 아직 제공하지 않아요.</p>
            </section>
        );
    }
    return <HarvestReadout plant={selectedPlant} prediction={prediction} />;
}

// 성장 추이 SVG (이 포트의 크기 변화). peerPoints를 주면 점선으로 함께 그리지만, 크기는 포트끼리 견주지 않으므로 지금은 쓰지 않는다.
function GrowthTrendSvg({ points, peerPoints, color }) {
    const vals = (points || []).map(p => p?.value).filter(v => v != null);
    if (!vals.length) {
        return <div className="h-12 flex items-center text-caption text-gray-500">아직 관측 데이터가 없어요</div>;
    }
    const w = 240, h = 48;
    const peerVals = (peerPoints || []).map(p => p?.value).filter(v => v != null);
    const all = vals.concat(peerVals);
    const mx = Math.max(...all), mn = Math.min(...all), r = (mx - mn) || 1;
    const n = points.length;
    const st = n > 1 ? w / (n - 1) : w;
    const Y = v => h - 3 - ((v - mn) / r) * (h - 8);
    const path = (arr) => {
        let d = "", started = false;
        (arr || []).forEach((pt, i) => {
            const v = pt?.value;
            if (v == null) { started = false; return; }
            d += `${started ? "L" : "M"}${(i * st).toFixed(1)} ${Y(v).toFixed(1)} `;
            started = true;
        });
        return d.trim();
    };
    const selfPath = path(points);
    const peerPath = path(peerPoints);
    const lastIdx = n - 1;
    const lastV = points[lastIdx]?.value;
    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
            {peerPath && <path d={peerPath} fill="none" stroke="#737373" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.7" />}
            <path d={selfPath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {lastV != null && <circle cx={(lastIdx * st).toFixed(1)} cy={Y(lastV).toFixed(1)} r="3"
                fill={points[lastIdx]?.lowerBound ? "none" : color} stroke={color} strokeWidth="1.5" />}
        </svg>
    );
}

// 성장 추이 카드 (이 포트 자신의 크기 변화)
function GrowthTrendCard({ trend, loading, error, color }) {
    const points = trend?.points ?? [];
    return (
        <div className="rounded-xl bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-1">
                <span className="text-caption font-bold text-gray-500">성장 추이</span>
            </div>
            {loading ? (
                <div className="h-12 flex items-center text-caption text-gray-500">불러오는 중...</div>
            ) : error ? (
                <div className="h-12 flex items-center text-caption text-red-600">관측 데이터를 불러오지 못했어요.</div>
            ) : (
                <GrowthTrendSvg points={points} color={color} />
            )}
        </div>
    );
}


const COMPARISON_COLOR = { faster: "text-brand", similar: "text-gray-700", slower: "text-amber-700" };

// 현재 관측 요약 (크기/질병/이 포트의 과거 대비 크기/같은 시기 다른 재배와의 속도 비교)
function PortObservation({ plant, trend, error }) {
    if (!plant) {
        return <div className="rounded-xl bg-gray-50 p-4 flex items-center justify-center text-caption text-gray-500">데이터 없음</div>;
    }
    const latest = currentSizeRatio(trend);
    const sizeChange = trend?.sizeChange;
    const comparison = trend?.reference;
    const diseased = isDiseased(plant.diseaseResult);
    const items = [
        ["현재 크기 지표", error ? "조회 실패" : latest != null
            ? `${trend?.latestLowerBound ? "최소 " : ""}${(latest * 100).toFixed(1)}%` : trend ? "계산 대기" : "관측 없음", "text-gray-700"],
        ["질병 검출", diseased ? plant.diseaseResult : "판단 대기", diseased ? "text-red-600" : "text-gray-500"],
        ["과거 대비 크기", describeSizeChange(sizeChange),
            !sizeChange?.ready ? "text-gray-500"
                : sizeChange.changePercent >= -SAME_SIZE_BAND_PERCENT ? "text-brand" : "text-amber-700"],
        ["같은 품종·시기 성장 속도", describeComparison(comparison),
            comparison?.ready ? COMPARISON_COLOR[comparison.verdict] : "text-gray-500"],
    ];
    return (
        <div className="rounded-xl bg-gray-50 p-4 grid grid-cols-2 gap-2 content-start">
            {items.map(([k, v, c]) => (
                <div key={k}>
                    <div className="text-caption text-gray-500">{k}</div>
                    <div className={`text-body2 font-bold ${c}`}>{v}</div>
                </div>
            ))}
        </div>
    );
}

// AI 정밀 포트 분석 — '분석 요청' 버튼을 눌러야 이 포트의 센서·성장 데이터를 LLM에 보내고,
// 응답을 받아 표시한다. 처음에는 결과 없이 버튼만 보인다(온디맨드 · 토큰 절약).
function PortProblemBlock({ plant, trend, serialNumber, speciesId, speciesName, daysSincePlanted }) {
    const [llm, setLlm] = useState(null);
    const [llmLoading, setLlmLoading] = useState(false);
    const [llmError, setLlmError] = useState(false);
    if (!plant) return null;

    const runDiagnosis = async () => {
        setLlmLoading(true); setLlmError(false);
        try {
            const token = localStorage.getItem("token");
            const currentSize = currentSizeRatio(trend);
            const res = await fetch(`${API_BASE}/ai/port-diagnosis`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    serialNumber,
                    speciesId: speciesId ?? null,
                    speciesName: speciesName ?? null,
                    portIndex: plant.portIndex,
                    daysSincePlanted: daysSincePlanted ?? null,
                    plantStage: plant.stageName ?? null,
                    sizeChangeDays: trend?.sizeChange?.ready ? trend.sizeChange.days : null,
                    sizeChangePercent: trend?.sizeChange?.ready ? Math.round(trend.sizeChange.changePercent) : null,
                    speedVerdict: trend?.reference?.ready ? trend.reference.verdict : null,
                    ownRatePerDay: trend?.reference?.ready && trend.growthRate.ready
                        ? Math.round(trend.growthRate.ratePerDay) : null,
                    referenceRatePerDay: trend?.reference?.ready ? Math.round(trend.reference.ratePerDay) : null,
                    referencePlantCount: trend?.reference?.ready ? trend.reference.plantCount : null,
                    currentSizePercent: currentSize != null
                        ? Math.round(currentSize * 1000) / 10 : null,
                    diseaseResult: plant.diseaseResult ?? null,
                }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setLlm(data.advice || "분석 결과가 비어 있습니다.");
        } catch {
            setLlmError(true);
        } finally {
            setLlmLoading(false);
        }
    };

    return (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[12.5px] text-gray-700">🤖 AI 정밀 포트 분석</span>
                <button onClick={runDiagnosis} disabled={llmLoading}
                    className="shrink-0 rounded-lg border border-brand-olive bg-white px-3 py-1 text-caption font-bold text-brand hover:bg-brand-cream disabled:opacity-50">
                    {llmLoading ? "분석 중…" : llm ? "다시 분석" : "분석 요청"}
                </button>
            </div>

            {llmLoading && <p className="mt-2 text-caption text-gray-500">AI가 분석 중입니다…</p>}
            {llmError && <p className="mt-2 text-caption text-red-600">분석을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
            {llm && (
                <div className="mt-2">
                    <p className="text-caption text-gray-700 whitespace-pre-line ">{llm}</p>
                    <p className="mt-2 text-caption text-gray-500">생성형 AI 추정 · 확정 진단 아님</p>
                </div>
            )}
        </div>
    );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
function MonitoringPage() {
    const { serialNumber } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const targetPortIndex = location.state?.portIndex;
    const activePerfRun = getActiveMonitoringPerformanceRun(location.state?.perfRunId, serialNumber);
    const perfRunId = activePerfRun?.id ?? location.state?.perfRunId ?? null;
    const coreVisibleMarkedRef = useRef(false);
    const firstSensorMarkedRef = useRef(false);
    const performanceFinishedRef = useRef(false);

    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [noticesSettled, setNoticesSettled] = useState(false);
    const [predictionSettled, setPredictionSettled] = useState(false);

    const [sensorData, setSensorData] = useState(() => {
        try {
            const saved = sessionStorage.getItem(getSensorKey(serialNumber));
            return saved ? JSON.parse(saved) : {
                temperature: null, humidity: null, ph: null, tds: null, water_level_status: null,
            };
        } catch {
            return { temperature: null, humidity: null, ph: null, tds: null, water_level_status: null };
        }
    });

    const [sseConnected, setSseConnected] = useState(false);

    const [notices, setNotices] = useState(() => {
        try {
            const saved = sessionStorage.getItem(getNoticeKey(serialNumber));
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [noticeVisibleCount, setNoticeVisibleCount] = useState(10);

    const [selectedPort, setSelectedPort] = useState(0);
    const [prediction, setPrediction] = useState(null);
    const [aiAdvice, setAiAdvice] = useState(null);

    // ── 분리된 로딩 상태 ───────────────────────────────────────
    const [adviceAiLoading, setAdviceAiLoading] = useState(false);

    const PORT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

    const storageKey = `device_settings_${serialNumber}`;
    const getSavedSettings = () => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    };
    const saved = getSavedSettings();

    const [isLedOn, setIsLedOn] = useState(saved?.isLedOn ?? true);
    const [isLedAuto, setIsLedAuto] = useState(saved?.isLedAuto ?? false);
    const [ledStart, setLedStart] = useState(saved?.ledStart ?? "06:00");
    const [ledEnd, setLedEnd] = useState(saved?.ledEnd ?? "22:00");
    const [captureInterval, setCaptureInterval] = useState(6);
    const [saveMessage, setSaveMessage] = useState("");
    const [ledSaving, setLedSaving] = useState(false);
    const [captureSaving, setCaptureSaving] = useState(false);

    useEffect(() => {
        coreVisibleMarkedRef.current = false;
        firstSensorMarkedRef.current = false;
        performanceFinishedRef.current = false;
        markMonitoringPerformance(perfRunId, "monitoring_route_rendered");
    }, [serialNumber, perfRunId]);

    // ── 포트 관측 새로고침 (성장 추이와 속도 비교를 다시 불러온다) ──
    const [growthTrendRefresh, setGrowthTrendRefresh] = useState(0);
    const handleRefreshObservation = useCallback(() => setGrowthTrendRefresh(count => count + 1), []);

    // ── AI 재배 조언만 새로고침 (조언 텍스트) ────────────────────
    const handleRefreshAdvice = useCallback(async (deviceData, plantData) => {
        if (!deviceData) return;
        setAdviceAiLoading(true);
        const advice = await fetchAiData(deviceData, plantData, sensorData);
        setAiAdvice(advice);
        setAdviceAiLoading(false);
    }, [sensorData]);

    // ── 1. 디바이스 + 부가 데이터 로드
    useEffect(() => {
        const loadNotices = async () => {
            try {
                const noticeRes = await measureMonitoringApi(
                    perfRunId,
                    "notices",
                    getAllNoticesApi
                );
                const filtered = noticeRes.data.filter(
                    n => n.deviceSerial === serialNumber
                );
                setNotices(filtered);
                sessionStorage.setItem(
                    getNoticeKey(serialNumber),
                    JSON.stringify(filtered)
                );
                markMonitoringPerformance(perfRunId, "notices_settled", {
                    totalCount: noticeRes.data.length,
                    filteredCount: filtered.length,
                });
            } catch (e) {
                console.error("[Initial notices]", e);
            } finally {
                setNoticesSettled(true);
            }
        };

        const fetchData = async () => {
            setLoading(true);
            setNoticesSettled(false);
            setPredictionSettled(false);

            try {
                const res = await measureMonitoringApi(
                    perfRunId,
                    "devices",
                    getUserDevicesApi
                );
                const found = res.data.find(d => d.serialNumber === serialNumber);
                setDevice(found);
                markMonitoringPerformance(perfRunId, "device_data_ready", {
                    deviceFound: Boolean(found),
                    deviceCount: res.data.length,
                });

                if (found) {
                    setIsLedOn(found.ledStatus ?? true);
                    setIsLedAuto(found.ledMode ?? false);
                    setLedStart(found.ledOnTime ?? "06:00");
                    setLedEnd(found.ledOffTime ?? "22:00");
                    setCaptureInterval(found.photoInterval >= 1 && found.photoInterval <= 6
                        ? found.photoInterval : 6);
                    const targetPort = targetPortIndex;
                    if (targetPort !== null && targetPort !== undefined) {
                        setSelectedPort(targetPort);
                    } else if (found.plants?.length > 0) {
                        const portStatus = found.portStatus || "00000000";
                        const onPortWithPlant = found.plants.find(p => portStatus[p.portIndex] === "1");
                        if (onPortWithPlant) setSelectedPort(onPortWithPlant.portIndex);
                        else {
                            const firstPlant = found.plants.reduce((a, b) => a.portIndex < b.portIndex ? a : b);
                            setSelectedPort(firstPlant.portIndex);
                        }
                    }
                }

                // 기기 데이터가 준비되는 즉시 핵심 화면을 먼저 표시한다.
                setLoading(false);

                // AI 조언과 알림은 서로 기다리지 않고 독립적으로 불러온다.
                loadNotices();
            } catch (e) {
                console.error("[Initial device]", e);
                setLoading(false);
                setNoticesSettled(true);
            }
        };
        fetchData();
    }, [serialNumber, perfRunId, targetPortIndex]);

    // 포트를 바꾸면 그 포트의 품종과 생육 단계로 AI 조언을 다시 불러온다.
    useEffect(() => {
        if (!device) return;
        const plant = device.plants?.find(item => item.portIndex === selectedPort);
        if (!plant) {
            setAiAdvice(null);
            setAdviceAiLoading(false);
            return;
        }
        let active = true;
        setAiAdvice(null);
        setAdviceAiLoading(true);
        measureMonitoringApi(perfRunId, "ai_advice", () => fetchAiData(device, plant, sensorData))
            .then(advice => {
                if (!active) return;
                setAiAdvice(advice);
                markMonitoringPerformance(perfRunId, "ai_advice_settled", { hasAdvice: Boolean(advice) });
            })
            .catch(error => { if (active) console.error("[AI advice]", error); })
            .finally(() => {
                if (active) setAdviceAiLoading(false);
            });
        return () => { active = false; };
    }, [device, selectedPort, perfRunId, sensorData.temperature !== null]);

    // ── 2. 예측 조회
    useEffect(() => {
        let cancelled = false;
        setPrediction(null);
        if (!device) return;
        const plant = device.plants?.find(p => p.portIndex === selectedPort);
        if (!plant || !isLettucePlant(plant)) {
            setPrediction(null);
            setPredictionSettled(true);
            markMonitoringPerformance(perfRunId, "prediction_settled", {
                hasPlant: Boolean(plant), supported: false,
            });
            return;
        }
        setPredictionSettled(false);
        const fetchPrediction = () => measureMonitoringApi(perfRunId, "prediction", () =>
            getLatestHarvestPredictionApi(plant.id))
            .then(res => {
                if (!cancelled) setPrediction(res.data ? { plantId: plant.id, ...res.data } : null);
            })
            .catch(() => {
                if (!cancelled) setPrediction({ plantId: plant.id, status: "LOAD_ERROR" });
            })
            .finally(() => {
                if (cancelled) return;
                setPredictionSettled(true);
                markMonitoringPerformance(perfRunId, "prediction_settled", { hasPlant: true });
            });
        fetchPrediction();
        const predictionTimer = setInterval(fetchPrediction, 60000);
        return () => { cancelled = true; clearInterval(predictionTimer); };
    }, [device, selectedPort, perfRunId]);

    // ── 3. AWS 환경에서는 최신 센서값을 주기적으로 조회한다.
    useEffect(() => {
        let cancelled = false;
        let timer = null;
        const pollLatestSensor = async () => {
            if (document.hidden) return;
            try {
                const res = await getLatestSensorApi(serialNumber);
                if (cancelled) return;
                if (res.status === 204 || !res.data) {
                    setSensorData(emptySensorData());
                    sessionStorage.removeItem(getSensorKey(serialNumber));
                    setSseConnected(false);
                    return;
                }
                const data = res.data;
                if (!firstSensorMarkedRef.current) {
                    firstSensorMarkedRef.current = true;
                    markMonitoringPerformance(perfRunId, "sensor_first_value");
                }
                setSensorData(() => {
                    const next = {
                        temperature:        data.temperature        ?? null,
                        humidity:           data.humidity           ?? null,
                        ph:                 data.ph                 ?? null,
                        tds:                data.tds                ?? null,
                        water_level_status: data.water_level_status ?? null,
                    };
                    sessionStorage.setItem(getSensorKey(serialNumber), JSON.stringify(next));
                    return next;
                });
                setSseConnected(true);
            } catch (err) {
                if (!cancelled) {
                    setSseConnected(false);
                    console.error("[Sensor poll]", err);
                }
            }
        };
        const startPolling = () => {
            if (timer || document.hidden) return;
            pollLatestSensor();
            timer = setInterval(pollLatestSensor, 60000);
        };
        const stopPolling = () => {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
        };
        const onVisibilityChange = () => document.hidden ? stopPolling() : startPolling();
        startPolling();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelled = true;
            stopPolling();
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [serialNumber, perfRunId]);

    useEffect(() => {
        if (!loading && device && !coreVisibleMarkedRef.current) {
            coreVisibleMarkedRef.current = true;
            markMonitoringPerformance(perfRunId, "monitoring_core_visible");
        }
    }, [loading, device, perfRunId]);

    useEffect(() => {
        if (
            !loading &&
            device &&
            noticesSettled &&
            predictionSettled &&
            !adviceAiLoading &&
            !performanceFinishedRef.current
        ) {
            performanceFinishedRef.current = true;
            finishMonitoringPerformanceRun(perfRunId, {
                hasDevice: true,
                noticeCount: notices.length,
                hasPrediction: Boolean(prediction),
                hasAiAdvice: Boolean(aiAdvice),
            });
        }
    }, [
        loading,
        device,
        noticesSettled,
        predictionSettled,
        adviceAiLoading,
        notices.length,
        prediction,
        aiAdvice,
        perfRunId,
    ]);

    // ── 4. 알림 폴링
    useEffect(() => {
        const pollNotices = async () => {
            try {
                const res = await getAllNoticesApi();
                const filtered = res.data.filter(n => n.deviceSerial === serialNumber);
                setNotices(prev => {
                    const existingIds = new Set(prev.map(n => n.id));
                    const newOnes = filtered.filter(n => !existingIds.has(n.id));
                    if (newOnes.length === 0) return prev;
                    const merged = [...newOnes, ...prev];
                    sessionStorage.setItem(getNoticeKey(serialNumber), JSON.stringify(merged));
                    return merged;
                });
            } catch (e) { console.error("[Notice poll]", e); }
        };
        const timer = setInterval(pollNotices, 60000);
        return () => clearInterval(timer);
    }, [serialNumber]);

    // ── LED 핸들러
    const handleLedManual = async (on) => {
        setIsLedOn(on);
        setLedSaving(true);
        try {
            await updateLedApi(serialNumber, { ledMode: false, ledStatus: on });
            localStorage.setItem(storageKey, JSON.stringify({ ...getSavedSettings(), isLedOn: on, isLedAuto: false }));
        } catch (e) { console.error("[LED] 수동 제어 실패", e); }
        finally { setLedSaving(false); }
    };

    const handleLedModeToggle = (auto) => {
        setIsLedAuto(auto);
        localStorage.setItem(storageKey, JSON.stringify({ ...getSavedSettings(), isLedAuto: auto }));
    };

    const handleLedScheduleSave = async () => {
        setLedSaving(true);
        try {
            await updateLedApi(serialNumber, { ledMode: true, ledOnTime: ledStart, ledOffTime: ledEnd });
            localStorage.setItem(storageKey, JSON.stringify({ ...getSavedSettings(), isLedAuto: true, ledStart, ledEnd }));
            setSaveMessage("✓ LED 스케줄 저장됨");
            setTimeout(() => setSaveMessage(""), 2000);
        } catch {
            setSaveMessage("⚠ LED 저장 실패");
            setTimeout(() => setSaveMessage(""), 2000);
        } finally { setLedSaving(false); }
    };

    const handleCaptureSave = async () => {
        setCaptureSaving(true);
        try {
            await updatePhotoIntervalApi(serialNumber, captureInterval);
            localStorage.setItem(storageKey, JSON.stringify({ ...getSavedSettings(), captureInterval }));
            setSaveMessage("✓ 촬영 주기 저장됨");
            setTimeout(() => setSaveMessage(""), 2000);
        } catch {
            setSaveMessage("⚠ 촬영 주기 저장 실패");
            setTimeout(() => setSaveMessage(""), 2000);
        } finally { setCaptureSaving(false); }
    };

    const handleResetSettings = async () => {
        if (!window.confirm("설정을 초기화할까요?")) return;
        setLedSaving(true);
        setCaptureSaving(true);
        try {
            await updateLedApi(serialNumber, { ledMode: false, ledStatus: true });
            setIsLedOn(true);
            setIsLedAuto(false);
            await updatePhotoIntervalApi(serialNumber, 6);
            setCaptureInterval(6);
            setLedStart("06:00");
            setLedEnd("22:00");
            localStorage.removeItem(storageKey);
            setSaveMessage("✓ 기기 설정이 초기화되었습니다");
        } catch (e) {
            console.error("[Settings reset]", e);
            setSaveMessage("⚠ 일부 기기 설정을 초기화하지 못했어요");
        } finally {
            setLedSaving(false);
            setCaptureSaving(false);
            setTimeout(() => setSaveMessage(""), 3000);
        }
    };

    // 선택 포트의 성장 추이(관측 크기) + 같은 시기 다른 재배와의 속도 비교. 성장추이 카드/현재관측/문제분석이 공유.
    const [growthTrend, setGrowthTrend] = useState(null);
    const [portHealthSnapshot, setPortHealthSnapshot] = useState(null);
    const [growthTrendLoading, setGrowthTrendLoading] = useState(false);
    const [growthTrendError, setGrowthTrendError] = useState(false);
    useEffect(() => {
        // 빈 포트를 선택해도 서버의 전체 포트 상태를 받아 색상 점을 표시한다.
        if (!serialNumber || !device) {
            setGrowthTrend(null);
            setGrowthTrendError(false);
            setPortHealthSnapshot(null);
            return;
        }
        let alive = true;
        setGrowthTrend(null);
        setGrowthTrendError(false);
        setGrowthTrendLoading(true);
        getGrowthTrendApi(serialNumber, selectedPort)
            .then(res => {
                if (!alive) return;
                setGrowthTrend(res.data);
                if (Array.isArray(res.data?.ports)) {
                    setPortHealthSnapshot({
                        serialNumber,
                        byIndex: Object.fromEntries(res.data.ports.map(port => [port.portIndex, port.health])),
                    });
                } else {
                    setPortHealthSnapshot(null);
                }
            })
            .catch(() => { if (alive) { setGrowthTrend(null); setPortHealthSnapshot(null); setGrowthTrendError(true); } })
            .finally(() => { if (alive) setGrowthTrendLoading(false); });
        return () => { alive = false; };
    }, [serialNumber, selectedPort, device, growthTrendRefresh]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-500 text-body2">로딩 중...</div>
        </div>
    );
    if (!device) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-500 text-body2">기기를 찾을 수 없어요</div>
        </div>
    );

    const { temperature: temp, humidity, ph, tds, water_level_status } = sensorData;
    const waterOk      = water_level_status === true;
    const waterHasData = water_level_status !== null;
    const portStatus = device.portStatus || "00000000";
    const selectedPlant = device.plants?.find(p => p.portIndex === selectedPort) ?? null;
    const ranges = deviceSensorRanges(device.plants || []);
    const tempOk  = sharedSensorStatus(temp, ranges.temp);
    const humidOk = sharedSensorStatus(humidity, ranges.humidity);
    const phOk    = sharedSensorStatus(ph, ranges.ph);
    const tdsOk   = sharedSensorStatus(tds, ranges.tds);

    const selectedSpeciesName = selectedPlant?.species || selectedPlant?.speciesName || null;
    const stageNames = Array.isArray(selectedPlant?.stageNames) && selectedPlant.stageNames.length > 0
        ? selectedPlant.stageNames
        : ["씨앗", "발아", "수확"];
    const emoji = SPECIES_EMOJI[selectedSpeciesName] || "🌱";
    const daysSincePlanted = selectedPlant?.plantedAt
        ? Math.floor((new Date() - new Date(selectedPlant.plantedAt.replace(" ", "T"))) / (1000 * 60 * 60 * 24))
        : null;

    // 센서와 영상 근거를 따로 계산한다. 단일 날짜/두 포트의 비교값은 사용하지 않는다.
    const visionScore = calcVisionScore(sensorData, ranges);
    const evidencedTrend = prepareGrowthTrend(growthTrend?.portIndex === selectedPort ? growthTrend : null);
    const portHealth = calcPortHealth(visionScore, selectedPlant, evidencedTrend);
    const healthByPort = portHealthSnapshot?.serialNumber === serialNumber ? portHealthSnapshot.byIndex : {};
    const selectedHealth = resolvePortHealth(selectedPlant, healthByPort[selectedPort]);
    const selectedHealthColor = HEALTH_COLOR[selectedHealth];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── 고정: 네비 아래 상단바(실시간 연결). 내부는 네비와 동일 폭(container-page) ── */}
            <div className="bg-white border-b border-gray-100">
                <div className="container-page py-3 flex items-center gap-3">
                    <button onClick={() => navigate("/")} className="text-gray-500 hover:text-gray-600 text-body2">←</button>
                    <span className="font-bold text-gray-800 text-body2">{device.deviceNickname} 모니터링</span>
                    <span className="flex items-center gap-1 text-caption font-medium"
                        style={{ color: sseConnected ? "#66A368" : "#f59e0b" }}>
                        <span className={`w-2 h-2 rounded-full inline-block ${sseConnected ? "bg-brand animate-pulse" : "bg-amber-400"}`} />
                        {sseConnected ? "실시간 연결" : "재연결 중..."}
                    </span>
                </div>
            </div>

            <div className="container-page py-6 lg:py-10">

                {/* ═══════════ 기기 공통 상태 ═══════════ */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-body1">🌐</span>
                    <h2 className="text-body2 font-bold text-gray-700">기기 공통 상태</h2>
                    <span className="text-caption text-gray-500">센서값과 적정 판정은 기기 전체 품종의 공통 범위 기준</span>
                    <div className="flex-1 border-t border-gray-200 ml-2" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* 온도 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-caption text-gray-500 font-medium ">TEMPERATURE</span>
                            <span className="text-sub1">🌡️</span>
                        </div>
                        <div className={`text-h2 sm:text-h1 font-bold transition-colors ${tempOk ? "text-brand" : tempOk === false ? "text-amber-700" : "text-gray-500"}`}>
                            {temp !== null && temp !== undefined ? `${temp}°C` : "-"}
                        </div>
                        <div className="mt-2 text-caption text-gray-500">
                            {tempOk === true ? "✓ 적정 범위" : tempOk === false ? "⚠ 범위 벗어남" : temp !== null ? "적정 범위 미설정" : "데이터 없음"}
                        </div>
                    </div>
                    {/* 습도 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-caption text-gray-500 font-medium ">HUMIDITY</span>
                            <span className="text-sub1">💧</span>
                        </div>
                        <div className={`text-h2 sm:text-h1 font-bold transition-colors ${humidOk ? "text-brand" : humidOk === false ? "text-amber-700" : "text-gray-500"}`}>
                            {humidity !== null && humidity !== undefined ? `${humidity}%` : "-"}
                        </div>
                        <div className="mt-2 text-caption text-gray-500">
                            {humidOk === true ? "✓ 정상" : humidOk === false ? "⚠ 확인 필요" : humidity !== null ? "적정 범위 미설정" : "데이터 없음"}
                        </div>
                    </div>

                    {/* 양액 시스템 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm lg:col-span-2">
                        <h2 className="text-body2 font-bold text-gray-700 mb-4">📊 양액 시스템 모니터링</h2>
                        <div className="grid grid-cols-3 gap-4">
                            {/* WATER */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="relative w-14 sm:w-16 h-14 sm:h-16 rounded-full overflow-hidden"
                                    style={{
                                        border: !waterHasData ? "4px solid #E5E5E5" : waterOk ? "4px solid #879958" : "4px solid #fca5a5",
                                        background: !waterHasData ? "#FAFAFA" : waterOk ? "#EFEDDE" : "#fef2f2",
                                    }}>
                                    {waterOk && (
                                        <>
                                            <div style={{ position: "absolute", bottom: 0, left: "-50%", width: "200%", height: "55%", background: "rgba(102,163,104,0.4)", borderRadius: "40%", animation: "wave1 2.4s ease-in-out infinite" }} />
                                            <div style={{ position: "absolute", bottom: 0, left: "-50%", width: "200%", height: "50%", background: "rgba(48,77,49,0.55)", borderRadius: "38%", animation: "wave2 2s ease-in-out infinite" }} />
                                        </>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="text-caption font-bold" style={{ color: !waterHasData ? "#D4D4D4" : waterOk ? "#304D31" : "#ef4444" }}>
                                            {!waterHasData ? "-" : waterOk ? "있음" : "없음"}
                                        </span>
                                    </div>
                                    <style>{`
                                        @keyframes wave1 { 0%{transform:translateX(0) rotate(0deg)} 50%{transform:translateX(8%) rotate(5deg)} 100%{transform:translateX(0) rotate(0deg)} }
                                        @keyframes wave2 { 0%{transform:translateX(0) rotate(0deg)} 50%{transform:translateX(-8%) rotate(-5deg)} 100%{transform:translateX(0) rotate(0deg)} }
                                    `}</style>
                                </div>
                                <span className="text-caption text-gray-500">WATER</span>
                                <span className={`text-caption font-bold px-2 py-1 rounded-full ${!waterHasData ? "bg-gray-100 text-gray-500" : waterOk ? "bg-brand-cream text-brand" : "bg-red-100 text-red-600"}`}>
                                    {!waterHasData ? "-" : waterOk ? "정상" : "부족"}
                                </span>
                            </div>
                            {/* PH */}
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors ${phOk ? "border-brand-olive/40 bg-brand-cream" : phOk === false ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
                                    <span className={`text-body1 sm:text-sub1 font-bold transition-colors ${phOk ? "text-brand" : phOk === false ? "text-amber-700" : "text-gray-500"}`}>
                                        {ph ?? "-"}
                                    </span>
                                </div>
                                <span className="text-caption text-gray-500">PH LEVEL</span>
                                <span className={`text-caption font-medium ${phOk ? "text-brand" : phOk === false ? "text-amber-700" : "text-gray-500"}`}>
                                    {ph !== null ? (phOk === null ? "범위 미설정" : phOk ? "적정" : "조정 필요") : "-"}
                                </span>
                            </div>
                            {/* TDS */}
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors ${tdsOk ? "border-brand-olive/40 bg-brand-cream" : tdsOk === false ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
                                    <span className={`text-body1 sm:text-sub1 font-bold transition-colors ${tdsOk ? "text-brand" : tdsOk === false ? "text-amber-700" : "text-gray-500"}`}>
                                        {tds !== null ? Math.round(tds) : "-"}
                                    </span>
                                </div>
                                <span className="text-caption text-gray-500">TDS (PPM)</span>
                                <span className={`text-caption font-medium ${tdsOk ? "text-brand" : tdsOk === false ? "text-amber-700" : "text-gray-500"}`}>
                                    {tds !== null ? (tdsOk === null ? "범위 미설정" : tdsOk ? "정상" : "확인 필요") : "-"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 시스템 제어 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm lg:col-span-2">
                        <h2 className="text-body2 font-bold text-gray-700 mb-4">⚙️ 시스템 제어</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* LED */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-caption font-medium text-gray-600">💡 LED 조명</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-caption font-medium ${!isLedAuto ? "text-gray-700" : "text-gray-500"}`}>수동</span>
                                        <div onClick={() => handleLedModeToggle(!isLedAuto)}
                                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isLedAuto ? "bg-brand" : "bg-gray-300"}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${isLedAuto ? "left-5" : "left-1"}`} />
                                        </div>
                                        <span className={`text-caption font-medium ${isLedAuto ? "text-brand" : "text-gray-500"}`}>자동</span>
                                    </div>
                                </div>
                                {!isLedAuto && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => handleLedManual(true)} disabled={ledSaving}
                                            className={`py-2 rounded-lg text-caption font-bold border transition-colors disabled:opacity-50 ${isLedOn ? "bg-amber-400 border-amber-200 text-white" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-amber-200 hover:text-amber-700"}`}>
                                            ☀️ ON
                                        </button>
                                        <button onClick={() => handleLedManual(false)} disabled={ledSaving}
                                            className={`py-2 rounded-lg text-caption font-bold border transition-colors disabled:opacity-50 ${!isLedOn ? "bg-gray-400 border-gray-400 text-white" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-600"}`}>
                                            🌙 OFF
                                        </button>
                                    </div>
                                )}
                                {isLedAuto && (
                                    <div className="flex flex-col gap-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-caption text-gray-500">시작 시간</label>
                                                <input type="time" value={ledStart} onChange={e => setLedStart(e.target.value)}
                                                    className="w-full border border-gray-100 rounded-lg px-2 py-1 text-caption focus:outline-none focus:ring-1 focus:ring-brand-leaf mt-1" />
                                            </div>
                                            <div>
                                                <label className="text-caption text-gray-500">종료 시간</label>
                                                <input type="time" value={ledEnd} onChange={e => setLedEnd(e.target.value)}
                                                    className="w-full border border-gray-100 rounded-lg px-2 py-1 text-caption focus:outline-none focus:ring-1 focus:ring-brand-leaf mt-1" />
                                            </div>
                                        </div>
                                        <button onClick={handleLedScheduleSave} disabled={ledSaving}
                                            className="w-full bg-brand hover:bg-brand-deep disabled:opacity-50 text-white text-caption font-bold py-2 rounded-lg transition-colors">
                                            {ledSaving ? "저장 중..." : "스케줄 적용"}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* 촬영 주기 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-caption font-medium text-gray-600">📷 촬영 주기</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <select value={captureInterval} onChange={e => setCaptureInterval(Number(e.target.value))}
                                        className="w-full border border-gray-100 rounded-lg px-2 py-2 text-caption focus:outline-none focus:ring-1 focus:ring-brand-leaf">
                                        {[1, 2, 3, 4, 5, 6].map(hours =>
                                            <option key={hours} value={hours}>{hours}시간</option>
                                        )}
                                    </select>
                                    <button onClick={handleCaptureSave} disabled={captureSaving}
                                        className="w-full bg-brand hover:bg-brand-deep disabled:opacity-50 text-white text-caption font-bold py-2 rounded-lg transition-colors">
                                        {captureSaving ? "저장 중..." : "주기 적용"}
                                    </button>
                                </div>
                                <p className="text-caption text-gray-500  mt-2">
                                    주기마다 타워가 360° 회전하며 전체 식물을 촬영합니다.
                                </p>
                            </div>
                        </div>
                        {saveMessage && (
                            <div className={`text-caption text-center mt-3 font-medium ${saveMessage.startsWith("⚠") ? "text-amber-700" : "text-brand"}`}>
                                {saveMessage}
                            </div>
                        )}
                        <button onClick={handleResetSettings} disabled={ledSaving || captureSaving}
                            className="w-full mt-4 border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 text-body2 py-3 rounded-xl transition-colors">
                            설정 초기화
                        </button>
                    </div>

                    {/* AI 재배 조언 */}
                    <div className="bg-brand-cream rounded-2xl border border-brand-olive/40 p-4 lg:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-body2">🤖</span>
                                <h2 className="text-body2 font-bold text-brand">AI 재배 조언</h2>
                            </div>
                            <button
                                onClick={() => handleRefreshAdvice(device, selectedPlant)}
                                disabled={adviceAiLoading}
                                className="text-caption text-brand hover:text-brand-deep disabled:text-brand-olive underline transition-colors"
                            >
                                새로고침
                            </button>
                        </div>
                        {adviceAiLoading ? (
                            <div className="flex items-center justify-center py-6 text-brand text-caption gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                AI가 분석 중이에요...
                            </div>
                        ) : aiAdvice ? (
                            <div className="max-h-63 overflow-y-auto pr-1">
                                <p className="text-caption text-brand  whitespace-pre-wrap">{aiAdvice}</p>
                            </div>
                        ) : (
                            <p className="text-caption text-gray-500 text-center py-4">조언을 불러올 수 없어요</p>
                        )}
                    </div>

                    {/* 최근 알림 (전체폭) */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm lg:col-span-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-body2">🔔</span>
                                <h2 className="text-body2 font-bold text-gray-700">최근 알림</h2>
                            </div>
                            {notices.length > 0 && (
                                <span className="text-caption bg-brand-cream text-brand font-bold px-2 py-1 rounded-full">
                                    {notices.length}
                                </span>
                            )}
                        </div>
                        {notices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 text-gray-500 py-8">
                                <span className="text-h4">🔕</span>
                                <p className="text-caption">새로운 알림이 없어요</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-caption text-gray-500">
                                    {notices.slice(0, noticeVisibleCount).map(notice => (
                                        <div key={notice.id}
                                            className={`border-l-2 pl-2 py-1 ${notice.isRead ? "border-gray-200" : "border-brand-olive"}`}>
                                            <p className="font-medium text-gray-700">{notice.noticeType}</p>
                                            <p className="mt-1 ">{notice.message}</p>
                                            <p className="text-gray-500 mt-1">{notice.deviceSerial}</p>
                                        </div>
                                    ))}
                                </div>
                                {noticeVisibleCount < notices.length && (
                                    <button onClick={() => setNoticeVisibleCount(prev => prev + 10)}
                                        className="mt-3 w-full text-caption text-gray-500 hover:text-brand py-2 border border-dashed border-gray-200 hover:border-brand-olive rounded-lg transition-colors">
                                        더보기 ({notices.length - noticeVisibleCount}개 남음)
                                    </button>
                                )}
                                {noticeVisibleCount > 10 && (
                                    <button onClick={() => setNoticeVisibleCount(10)}
                                        className="mt-1 w-full text-caption text-gray-500 hover:text-gray-500 py-1 transition-colors">
                                        접기
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ═══════════ 포트별 상세 ═══════════ */}
                <div className="flex items-center gap-2 mt-8 mb-3">
                    <span className="text-body1">🔌</span>
                    <h2 className="text-body2 font-bold text-gray-700">포트별 상세</h2>
                    <span className="text-caption text-gray-500">선택한 포트만 표시 · 포트마다 생육단계·상태 다름</span>
                    <div className="flex-1 border-t border-gray-200 ml-2" />
                </div>

                {/* 포트 선택기 (헬스 점) */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-caption font-bold text-gray-500">포트 선택</span>
                        <div className="flex flex-wrap gap-2">
                            {PORT_OPTIONS.map(port => {
                                const portPlant = device.plants?.find(p => p.portIndex === port);
                                const isPortOn = portStatus[port] === "1";
                                const dot = resolvePortHealth(portPlant, healthByPort[port]);
                                return (
                                    <button key={port} onClick={() => setSelectedPort(port)}
                                        aria-label={`포트 ${port + 1}${isPortOn && portPlant ? " 사용 중" : ""}`}
                                        className={`relative h-8 min-w-8 rounded-lg border px-2 text-caption font-bold transition-colors ${
                                            selectedPort === port
                                                ? "border-brand bg-brand text-white shadow-sm"
                                                : isPortOn && portPlant
                                                    ? "border-brand-olive/40 bg-white text-brand hover:bg-brand-cream"
                                                    : "border-gray-100 bg-white text-gray-500"
                                        }`}>
                                        {port + 1}
                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white" style={{ background: HEALTH_COLOR[dot] }} />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="ml-auto inline-flex items-center gap-2 text-caption text-gray-500 sm:text-caption">
                            <strong className="text-gray-700">포트 {selectedPort + 1}</strong>
                            <span>·</span>
                            <span>{selectedPlant ? `${emoji} ${selectedSpeciesName || selectedPlant.name}` : "식물 미등록"}</span>
                            <span className={`font-bold ${portStatus[selectedPort] === "1" ? "text-brand" : "text-gray-500"}`}>
                                {portStatus[selectedPort] === "1" ? "● ON" : "○ OFF"}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-50 text-caption text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#66A368" }} />크기·속도 정상</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />크기·속도 주의</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }} />이상(질병)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#A3A3A3" }} />관측 대기</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#D4D4D4" }} />빈 포트</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:items-start">
                    {/* 좌: 식물정보 + Vision AI */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        {/* 식물 정보 */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-brand-cream flex items-center justify-center text-h4">{emoji}</div>
                                <div>
                                    <div className="font-bold text-gray-800 text-body2">{selectedSpeciesName || "미등록"}</div>
                                    <div className="text-caption text-gray-500">{serialNumber} · 포트 {selectedPort + 1}</div>
                                </div>
                            </div>
                            {selectedPlant ? (
                                <div className="flex flex-col gap-2 text-caption">
                                    {[
                                        { label: "재배 일수", value: daysSincePlanted !== null ? `${daysSincePlanted}일차` : "-" },
                                        {
                                            label: "등록된 생육 단계",
                                            value: selectedPlant.stageName
                                                || stageNames[Number(selectedPlant.stageIndex)]
                                                || selectedPlant.plantStage
                                                || "-",
                                        },
                                        { label: "품종", value: selectedSpeciesName || "-" },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                            <span className="text-gray-500">{label}</span>
                                            <span className="font-medium text-gray-700">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-caption text-gray-500 text-center py-2">이 포트에 식물이 없어요</p>
                            )}
                        </div>

                        {/* Vision AI 분석 — 센서 기반 실시간 점수 + AI 파싱 결과 */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-body2">🔍</span>
                                    <h2 className="text-body2 font-bold text-gray-700">포트 건강 진단</h2>
                                </div>
                                <button
                                    onClick={handleRefreshObservation}
                                    disabled={growthTrendLoading}
                                    className="text-caption text-brand hover:text-brand-deep font-medium disabled:text-gray-300 transition-colors"
                                >
                                    {growthTrendLoading ? "불러오는 중..." : "↻ 새로고침"}
                                </button>
                            </div>

                            {!portHealth.portDataAvailable ? (
                                <div className="flex items-center gap-3 mb-1 p-3 bg-gray-50 rounded-xl">
                                    <span className="text-sub1">🪴</span>
                                    <div>
                                        <p className="text-caption font-bold text-gray-500">진단 대기</p>
                                        <p className="text-caption text-gray-500 mt-1">
                                            {portHealth.reason === "no_plant"
                                                ? "이 포트에 등록된 식물이 없어요."
                                                : "센서 데이터가 아직 없어 환경 점수를 계산할 수 없어요."}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                            <>
                            <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-xl">
                                <div className="relative w-12 h-12 flex-shrink-0">
                                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E5E5" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.9" fill="none"
                                            stroke={portHealth.score >= 80 ? "#66A368" : portHealth.score >= 55 ? "#f59e0b" : "#ef4444"}
                                            strokeWidth="3"
                                            strokeDasharray={`${portHealth.score} 100`}
                                            strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-caption font-bold text-gray-700">
                                        {portHealth.score}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-caption font-bold text-gray-700">{portHealth.grade}</p>
                                    {portHealth.issues.length > 0 && (
                                        <p className="text-caption text-amber-700 mt-1">
                                            ⚠ {portHealth.issues.slice(0, 2).join(", ")}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {growthTrendLoading ? (
                                <div className="flex flex-col gap-2">
                                    {["재배 환경 상태", "환경 위험도"].map(label => (
                                        <div key={label} className="flex justify-between items-center py-1">
                                            <span className="text-caption text-gray-500">{label}</span>
                                            <span className="w-16 h-3 bg-gray-100 rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 text-caption">
                                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                        <span className="text-gray-500">
                                            {evidencedTrend?.reference?.ready ? "환경·성장 관측 상태" : "재배 환경 상태"}
                                        </span>
                                        <span className={`font-medium ${
                                            portHealth.growthStatus === "정상" ? "text-brand" :
                                            portHealth.growthStatus === "주의" ? "text-amber-700" : "text-red-600"
                                        }`}>
                                            {portHealth.growthStatus === "정상" ? "✓ " : "⚠ "}
                                            {portHealth.growthStatus}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-gray-500">
                                            {isDiseased(selectedPlant?.diseaseResult) ? "질병·환경 위험" : "환경 위험도"}
                                        </span>
                                        <span className={`font-medium ${
                                            portHealth.diseaseRisk === "낮음" ? "text-brand" :
                                            portHealth.diseaseRisk === "보통" ? "text-amber-700" : "text-red-600"
                                        }`}>
                                            {portHealth.diseaseRisk === "낮음" ? "✓ " : "⚠ "}
                                            {portHealth.diseaseRisk}
                                        </span>
                                    </div>
                                </div>
                            )}
                            </>
                            )}
                        </div>
                    </div>

                    {/* 우: 생육 상세 (다음단계 ETA + 성장추이 + 관측 + 문제분석) */}
                    <div className="lg:col-span-3 flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                            <div className="mb-4">
                                <h2 className="text-body2 font-bold text-gray-700">📈 생육 상세</h2>
                            </div>

                            <HarvestForecastSection
                                selectedPlant={selectedPlant}
                                prediction={prediction}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <GrowthTrendCard trend={evidencedTrend} loading={growthTrendLoading} error={growthTrendError} color={selectedHealthColor} />
                                <PortObservation plant={selectedPlant} trend={evidencedTrend} error={growthTrendError} />
                            </div>

                            {/* 포트를 바꾸면 이전 포트의 분석 결과가 남지 않게 식물별로 새로 만든다 */}
                            <PortProblemBlock key={selectedPlant?.id ?? "empty"} plant={selectedPlant} trend={evidencedTrend}
                                serialNumber={serialNumber} speciesId={selectedPlant?.speciesId ?? null}
                                speciesName={selectedSpeciesName} daysSincePlanted={daysSincePlanted} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MonitoringPage;
