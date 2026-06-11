import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { getUserDevicesApi, updateLedApi, updatePhotoIntervalApi } from "../../api/deviceApi";
import { getAllNoticesApi } from "../../api/noticeApi";
import { getSseStreamUrl } from "../../api/sensorApi";
import { getLatestPredictionApi } from "../../api/predictionApi";

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const STAGE_LABEL = { SEED: "씨앗", GERMINATION: "발아", MATURE: "성숙" };
const STAGE_INDEX = { SEED: 0, GERMINATION: 1, MATURE: 2 };

const getSensorKey = (serial) => `growlab_sensor_${serial}`;
const getNoticeKey = (serial) => `growlab_notices_${serial}`;

// ── 차트 헬퍼 ────────────────────────────────────────────────
const addHours = (date, h) => new Date(date.getTime() + h * 3600 * 1000);
const addDays  = (date, d) => new Date(date.getTime() + d * 86400 * 1000);
const fmtDate  = (date)    => `${date.getMonth() + 1}/${date.getDate()}`;

// ── AI 조언 API 호출 ──────────────────────────────────────────
const fetchAiData = async (deviceData, plantData) => {
    try {
        const token = localStorage.getItem("token");
        const daysSincePlanted = plantData?.plantedAt
            ? Math.floor((new Date() - new Date(plantData.plantedAt)) / (1000 * 60 * 60 * 24))
            : null;
        const response = await fetch("http://localhost:8080/api/ai/advice", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                serialNumber: deviceData.serialNumber,
                speciesName: plantData?.species || null,
                temperature: deviceData.temperature,
                humidity: deviceData.humidity,
                ph: deviceData.ph,
                ec: deviceData.ec,
                waterLevel: deviceData.waterLevel,
                daysSincePlanted,
                plantStage: plantData?.plantStage || null,
            })
        });
        const data = await response.json();
        return data.advice || null;
    } catch (err) {
        return null;
    }
};

// ── AI 조언 텍스트를 파싱해서 구조화된 분석 추출 ──────────────
const parseAiAnalysis = (adviceText) => {
    if (!adviceText) return null;

    const sections = {
        environment: null,
        lighting: null,
        nutrients: null,
        growth: null,
    };

    const lines = adviceText.split('\n').map(l => l.trim()).filter(Boolean);
    let currentSection = null;
    const sectionBuf = {};

    for (const line of lines) {
        if (line.includes('[환경 전반]') || line.startsWith('환경 전반')) {
            currentSection = 'environment';
            sectionBuf[currentSection] = [];
        } else if (line.includes('[조명 관리]') || line.startsWith('조명 관리')) {
            currentSection = 'lighting';
            sectionBuf[currentSection] = [];
        } else if (line.includes('[양액 시스템]') || line.startsWith('양액 시스템')) {
            currentSection = 'nutrients';
            sectionBuf[currentSection] = [];
        } else if (line.includes('[성장 속도]') || line.startsWith('성장 속도')) {
            currentSection = 'growth';
            sectionBuf[currentSection] = [];
        } else if (currentSection) {
            const colonIdx = line.indexOf(':');
            const content = colonIdx !== -1 && colonIdx < 10 ? line.slice(colonIdx + 1).trim() : line;
            if (content) sectionBuf[currentSection].push(content);
        }
    }

    sections.environment = sectionBuf['environment']?.join(' ') || null;
    sections.lighting    = sectionBuf['lighting']?.join(' ')    || null;
    sections.nutrients   = sectionBuf['nutrients']?.join(' ')   || null;
    sections.growth      = sectionBuf['growth']?.join(' ')      || null;

    if (!sections.environment && !sections.lighting) {
        const envMatch = adviceText.match(/환경 전반[：:]\s*(.+?)(?=조명|양액|성장|$)/s);
        const lightMatch = adviceText.match(/조명 관리[：:]\s*(.+?)(?=환경|양액|성장|$)/s);
        const nutriMatch = adviceText.match(/양액 시스템[：:]\s*(.+?)(?=환경|조명|성장|$)/s);
        const growMatch = adviceText.match(/성장 속도[：:]\s*(.+?)(?=환경|조명|양액|$)/s);

        sections.environment = envMatch?.[1]?.trim()   || null;
        sections.lighting    = lightMatch?.[1]?.trim() || null;
        sections.nutrients   = nutriMatch?.[1]?.trim() || null;
        sections.growth      = growMatch?.[1]?.trim()  || null;
    }

    return sections;
};

// ── Vision AI 분석 점수 계산 (센서 데이터 기반) ───────────────
const calcVisionScore = (deviceData, sensorData) => {
    const { temperature: temp, humidity, ph, tds, water_level_status } = sensorData;

    let score = 100;
    let issues = [];

    if (temp !== null) {
        if (temp < 15 || temp > 32)       { score -= 25; issues.push("온도 위험"); }
        else if (temp < 18 || temp > 28)  { score -= 10; issues.push("온도 주의"); }
    } else { score -= 5; }

    if (humidity !== null) {
        if (humidity < 30 || humidity > 90)      { score -= 20; issues.push("습도 위험"); }
        else if (humidity < 50 || humidity > 80) { score -= 8;  issues.push("습도 주의"); }
    } else { score -= 5; }

    if (ph !== null) {
        if (ph < 4.5 || ph > 8.0)       { score -= 20; issues.push("pH 위험"); }
        else if (ph < 5.5 || ph > 7.0)  { score -= 8;  issues.push("pH 주의"); }
    } else { score -= 5; }

    if (tds !== null) {
        if (tds < 100 || tds > 1500)        { score -= 15; issues.push("양액 위험"); }
        else if (tds < 200 || tds > 800)    { score -= 8;  issues.push("양액 주의"); }
    } else { score -= 5; }

    if (water_level_status === false) { score -= 15; issues.push("수위 부족"); }
    else if (water_level_status === null) { score -= 3; }

    score = Math.max(0, Math.min(100, score));

    const growthStatus =
        score >= 80 ? "정상" :
        score >= 55 ? "주의" : "위험";

    const diseaseRisk =
        issues.some(i => i.includes("위험")) ? "높음" :
        issues.length >= 2                   ? "보통" : "낮음";

    const grade =
        score >= 85 ? "우수" :
        score >= 70 ? "양호" :
        score >= 55 ? "보통" : "주의";

    return { score, grade, growthStatus, diseaseRisk, issues };
};

function GrowthSummary({ text }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > 60;
    return (
        <div className="pt-1 border-t border-gray-50 mt-1">
            <p className="text-[10px] text-gray-400 leading-relaxed">
                {!expanded && isLong ? text.slice(0, 60) + "..." : text}
            </p>
            {isLong && (
                <button
                    onClick={() => setExpanded(prev => !prev)}
                    className="text-[10px] text-green-500 hover:text-green-600 mt-0.5"
                >
                    {expanded ? "접기" : "더보기"}
                </button>
            )}
        </div>
    );
}

// ── 생육 타임라인 차트 ────────────────────────────────────────
function GrowthTimelineChart({ selectedPlant, prediction }) {
    const [hovered, setHovered] = useState(null);

    if (!selectedPlant) {
        return (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">
                이 포트에 등록된 식물이 없어요
            </div>
        );
    }

    const TODAY = new Date();
    const parseDate = (str) => {
        if (!str) return null;
        const normalized = str.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
        return new Date(normalized);
    };
    const plantedAt    = parseDate(selectedPlant.plantedAt);
    const germinatedAt = parseDate(selectedPlant.germinatedAt);
    const maturedAt    = parseDate(selectedPlant.maturedAt);

    if (!plantedAt || isNaN(plantedAt.getTime())) {
        return (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">
                재배 시작일 정보가 없어요
            </div>
        );
    }
    const currentStageIdx = STAGE_INDEX[selectedPlant.plantStage] ?? 0;

    const germinationEtaDate = (!germinatedAt && prediction?.germinationEtaHours)
        ? addHours(TODAY, prediction.germinationEtaHours) : null;
    const matureEtaDate = (!maturedAt && prediction?.matureEtaHours)
        ? addHours(TODAY, prediction.matureEtaHours) : null;

    const endDate = maturedAt || matureEtaDate || addDays(TODAY, 14);
    const totalMs = endDate - plantedAt;

    const W = 500, H = 160;
    const PAD = { top: 22, bottom: 40, left: 44, right: 16 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;

    const cx = (date) => PAD.left + ((date - plantedAt) / totalMs) * CW;
    const cy = (stage) => PAD.top + CH - (stage / 2) * CH;

    const realPts = [{ date: plantedAt, stage: 0, label: "파종" }];
    if (germinatedAt) realPts.push({ date: germinatedAt, stage: 1, label: "발아" });
    if (maturedAt)    realPts.push({ date: maturedAt,    stage: 2, label: "수확" });
    else              realPts.push({ date: TODAY, stage: currentStageIdx, label: "현재" });

    const predPts = [{ date: TODAY, stage: currentStageIdx }];
    if (germinationEtaDate) predPts.push({ date: germinationEtaDate, stage: 1 });
    if (matureEtaDate)      predPts.push({ date: matureEtaDate,      stage: 2 });

    const realPath = realPts.map((p, i) =>
        `${i === 0 ? "M" : "L"}${cx(p.date).toFixed(1)},${cy(p.stage).toFixed(1)}`
    ).join(" ");

    const predPath = predPts.length > 1
        ? predPts.map((p, i) =>
            `${i === 0 ? "M" : "L"}${cx(p.date).toFixed(1)},${cy(p.stage).toFixed(1)}`
          ).join(" ")
        : null;

    const todayX = cx(TODAY);

    const xLabels = [
        { date: plantedAt, lines: [fmtDate(plantedAt), "파종"] },
        ...(germinatedAt ? [{ date: germinatedAt, lines: [fmtDate(germinatedAt), "발아"] }] : []),
        { date: TODAY, lines: ["오늘"], highlight: true },
        ...(matureEtaDate ? [{ date: matureEtaDate, lines: [fmtDate(matureEtaDate), "수확예상"], pred: true }] : []),
        ...(maturedAt ? [{ date: maturedAt, lines: [fmtDate(maturedAt), "수확"], done: true }] : []),
    ];

    const daysLeft = matureEtaDate
        ? Math.round((matureEtaDate - TODAY) / 86400000)
        : null;

    let stageProbs = null;
    if (prediction?.stageProbs) {
        try { stageProbs = JSON.parse(prediction.stageProbs.replace(/'/g, '"')); } catch {}
    }

    const lgbLabel = prediction
        ? ["씨앗", "발아", "수확"][prediction.predictedStage]
        : null;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
                {daysLeft !== null && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                        🌾 수확 예상 D-{daysLeft}일 ({fmtDate(matureEtaDate)})
                    </span>
                )}
                {lgbLabel && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full">
                        72h 후 → {lgbLabel} ({Math.round((prediction.confidence ?? 0) * 100)}%)
                    </span>
                )}
                {!prediction && (
                    <span className="text-xs text-gray-300">예측 수집 중...</span>
                )}
            </div>

            <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 260 }}
                    onMouseLeave={() => setHovered(null)}>
                    <defs>
                        <filter id="tip-shadow">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
                        </filter>
                    </defs>
                    {[0, 1, 2].map(s => (
                        <g key={s}>
                            <line x1={PAD.left} y1={cy(s)} x2={W - PAD.right} y2={cy(s)}
                                stroke="#f3f4f6" strokeWidth="1" />
                            <text x={PAD.left - 6} y={cy(s)} textAnchor="end"
                                dominantBaseline="middle" fontSize="9" fill="#9ca3af">
                                {["씨앗", "발아", "수확"][s]}
                            </text>
                        </g>
                    ))}
                    <line x1={todayX} y1={PAD.top - 8} x2={todayX} y2={H - PAD.bottom + 2}
                        stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 2" />
                    <rect x={todayX} y={PAD.top}
                        width={Math.max(0, W - PAD.right - todayX)} height={CH}
                        fill="#f0fdf4" opacity="0.5" />
                    <path d={realPath} fill="none" stroke="#22c55e"
                        strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    {predPath && (
                        <path d={predPath} fill="none" stroke="#86efac"
                            strokeWidth="2" strokeDasharray="5 3"
                            strokeLinejoin="round" strokeLinecap="round" />
                    )}
                    {realPts.filter(p => p.label !== "현재").map((p, i) => (
                        <circle key={i}
                            cx={cx(p.date)} cy={cy(p.stage)} r="5"
                            fill={["#86efac", "#4ade80", "#16a34a"][p.stage]}
                            stroke="white" strokeWidth="2"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHovered(p)}
                        />
                    ))}
                    <circle cx={todayX} cy={cy(currentStageIdx)} r="5"
                        fill="#22c55e" stroke="white" strokeWidth="2">
                        <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {germinationEtaDate && (
                        <g onMouseEnter={() => setHovered({ date: germinationEtaDate, stage: 1, label: "발아 예상" })}>
                            <circle cx={cx(germinationEtaDate)} cy={cy(1)} r="5"
                                fill="#bbf7d0" stroke="white" strokeWidth="2" style={{ cursor: "pointer" }} />
                            <circle cx={cx(germinationEtaDate)} cy={cy(1)} r="9"
                                fill="none" stroke="#86efac" strokeWidth="1.5" opacity="0.5" />
                        </g>
                    )}
                    {matureEtaDate && (
                        <g onMouseEnter={() => setHovered({ date: matureEtaDate, stage: 2, label: "수확 예상" })}>
                            <circle cx={cx(matureEtaDate)} cy={cy(2)} r="5"
                                fill="#bbf7d0" stroke="white" strokeWidth="2" style={{ cursor: "pointer" }} />
                            <circle cx={cx(matureEtaDate)} cy={cy(2)} r="9"
                                fill="none" stroke="#86efac" strokeWidth="1.5" opacity="0.5" />
                        </g>
                    )}
                    {xLabels.map((l, i) => (
                        <g key={i}>
                            {l.lines.map((line, j) => (
                                <text key={j}
                                    x={cx(l.date)}
                                    y={H - PAD.bottom + 12 + j * 10}
                                    textAnchor="middle"
                                    fontSize={j === 0 ? "8" : "7"}
                                    fill={l.highlight ? "#22c55e" : l.pred ? "#86efac" : "#9ca3af"}
                                    fontWeight={l.highlight ? "600" : "400"}>
                                    {line}
                                </text>
                            ))}
                        </g>
                    ))}
                    {hovered && (() => {
                        const tx = cx(hovered.date);
                        const ty = cy(hovered.stage);
                        const flip = tx > W * 0.7;
                        const bx = flip ? tx - 82 : tx + 8;
                        return (
                            <g>
                                <rect x={bx} y={ty - 18} width="74" height="34"
                                    rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1"
                                    filter="url(#tip-shadow)" />
                                <text x={bx + 37} y={ty - 4} textAnchor="middle"
                                    fontSize="9" fill="#374151" fontWeight="600">
                                    {hovered.label || ["파종","발아","수확"][hovered.stage]}
                                </text>
                                <text x={bx + 37} y={ty + 8} textAnchor="middle"
                                    fontSize="8" fill="#6b7280">
                                    {fmtDate(hovered.date)}
                                </text>
                            </g>
                        );
                    })()}
                </svg>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[
                    {
                        label: "재배 시작",
                        value: fmtDate(plantedAt),
                        sub: `${Math.floor((TODAY - plantedAt) / 86400000)}일 전`,
                    },
                    {
                        label: "현재 단계",
                        value: STAGE_LABEL[selectedPlant.plantStage],
                        sub: lgbLabel ? `72h후 → ${lgbLabel}` : "예측 대기 중",
                    },
                    daysLeft !== null
                        ? { label: "수확 예상", value: fmtDate(matureEtaDate), sub: `D-${daysLeft}일`, highlight: true }
                        : maturedAt
                        ? { label: "수확 완료", value: fmtDate(maturedAt), sub: "✓ 완료", highlight: true }
                        : { label: "수확 예상", value: "-", sub: "예측 수집 중" },
                ].map(({ label, value, sub, highlight }) => (
                    <div key={label}
                        className={`rounded-xl p-2.5 text-center ${highlight ? "bg-green-50 border border-green-100" : "bg-gray-50"}`}>
                        <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                        <p className={`text-xs font-bold ${highlight ? "text-green-600" : "text-gray-700"}`}>{value}</p>
                        <p className={`text-[10px] ${highlight ? "text-green-500" : "text-gray-400"}`}>{sub}</p>
                    </div>
                ))}
            </div>

            {stageProbs && (
                <div className="flex flex-col gap-1 pt-1 border-t border-gray-50">
                    <p className="text-[10px] text-gray-400 mb-0.5">72h 후 단계별 확률</p>
                    {["씨앗", "발아", "수확"].map((name, i) => (
                        <div key={name} className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-6">{name}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full transition-all"
                                    style={{ width: `${Math.round((stageProbs[i] ?? 0) * 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 w-7 text-right">
                                {Math.round((stageProbs[i] ?? 0) * 100)}%
                            </span>
                        </div>
                    ))}
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

    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);

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
    const sseRef = useRef(null);
    const reconnectTimerRef = useRef(null);

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
    const [aiAnalysis, setAiAnalysis] = useState(null);

    // ── 분리된 로딩 상태 ───────────────────────────────────────
    const [visionAiLoading, setVisionAiLoading] = useState(false);
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
    const [captureInterval, setCaptureInterval] = useState(saved?.captureInterval ?? 12);
    const [saveMessage, setSaveMessage] = useState("");
    const [ledSaving, setLedSaving] = useState(false);
    const [captureSaving, setCaptureSaving] = useState(false);

    // ── Vision AI 분석만 새로고침 (점수 + 분석 섹션) ─────────────
    const handleRefreshVision = useCallback(async (deviceData, plantData) => {
        if (!deviceData) return;
        setVisionAiLoading(true);
        const advice = await fetchAiData(deviceData, plantData);
        setAiAnalysis(parseAiAnalysis(advice));
        setVisionAiLoading(false);
    }, []);

    // ── AI 재배 조언만 새로고침 (조언 텍스트) ────────────────────
    const handleRefreshAdvice = useCallback(async (deviceData, plantData) => {
        if (!deviceData) return;
        setAdviceAiLoading(true);
        const advice = await fetchAiData(deviceData, plantData);
        setAiAdvice(advice);
        setAdviceAiLoading(false);
    }, []);

    // ── 1. 디바이스 + 알림 로드
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await getUserDevicesApi();
                const found = res.data.find(d => d.serialNumber === serialNumber);
                setDevice(found);

                if (found) {
                    const targetPort = location.state?.portIndex;
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

                    // 초기 로드 시 한 번의 API 호출로 둘 다 세팅
                    setVisionAiLoading(true);
                    setAdviceAiLoading(true);
                    const representativePlant = found.plants?.find(p => p.species) ?? null;
                    const advice = await fetchAiData(found, representativePlant);
                    setAiAdvice(advice);
                    setAiAnalysis(parseAiAnalysis(advice));
                    setVisionAiLoading(false);
                    setAdviceAiLoading(false);
                }

                const noticeRes = await getAllNoticesApi();
                const filtered = noticeRes.data.filter(n => n.deviceSerial === serialNumber);
                setNotices(filtered);
                sessionStorage.setItem(getNoticeKey(serialNumber), JSON.stringify(filtered));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [serialNumber]);

    // ── 2. 예측 조회
    useEffect(() => {
        if (!device) return;
        const plant = device.plants?.find(p => p.portIndex === selectedPort);
        if (!plant) { setPrediction(null); return; }
        getLatestPredictionApi(plant.id)
            .then(res => setPrediction(res.data))
            .catch(() => setPrediction(null));
    }, [device, selectedPort]);

    // ── 3. SSE 연결
    const connectSSE = useCallback(() => {
        if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
        const es = new EventSource(getSseStreamUrl(serialNumber));
        sseRef.current = es;
        es.addEventListener("connect", () => setSseConnected(true));
        es.addEventListener("sensor", (e) => {
            try {
                const data = JSON.parse(e.data);
                setSensorData(prev => {
                    const next = {
                        temperature:        data.temperature        ?? prev.temperature,
                        humidity:           data.humidity           ?? prev.humidity,
                        ph:                 data.ph                 ?? prev.ph,
                        tds:                data.tds                ?? prev.tds,
                        water_level_status: data.water_level_status ?? prev.water_level_status,
                    };
                    sessionStorage.setItem(getSensorKey(serialNumber), JSON.stringify(next));
                    return next;
                });
                setSseConnected(true);
            } catch (err) { console.error("[SSE] parse error", err); }
        });
        es.onerror = () => {
            setSseConnected(false);
            es.close();
            sseRef.current = null;
            reconnectTimerRef.current = setTimeout(connectSSE, 5000);
        };
    }, [serialNumber]);

    useEffect(() => {
        connectSSE();
        return () => {
            if (sseRef.current) sseRef.current.close();
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        };
    }, [connectSSE]);

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
        } catch (e) {
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
        } catch (e) {
            setSaveMessage("⚠ 촬영 주기 저장 실패");
            setTimeout(() => setSaveMessage(""), 2000);
        } finally { setCaptureSaving(false); }
    };

    const handleResetSettings = () => {
        if (!window.confirm("설정을 초기화할까요?")) return;
        localStorage.removeItem(storageKey);
        setIsLedOn(true); setIsLedAuto(false);
        setLedStart("06:00"); setLedEnd("22:00");
        setCaptureInterval(12);
        setSaveMessage("✓ 초기화되었습니다");
        setTimeout(() => setSaveMessage(""), 2000);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-400 text-sm">로딩 중...</div>
        </div>
    );
    if (!device) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-400 text-sm">기기를 찾을 수 없어요</div>
        </div>
    );

    const { temperature: temp, humidity, ph, tds, water_level_status } = sensorData;
    const waterOk      = water_level_status === true;
    const waterHasData = water_level_status !== null;
    const tempOk  = temp     !== null && temp     >= 18 && temp     <= 28;
    const humidOk = humidity !== null && humidity >= 50 && humidity <= 80;
    const phOk    = ph       !== null && ph       >= 5.5 && ph      <= 7.0;
    const tdsOk   = tds      !== null && tds      >= 200 && tds     <= 800;

    const portStatus = device.portStatus || "00000000";
    const selectedPlant = device.plants?.find(p => p.portIndex === selectedPort) ?? null;
    const representativePlant = device.plants?.find(p => p.species) ?? null;
    const emoji = representativePlant ? (SPECIES_EMOJI[representativePlant.species] || "🌱") : "🌱";
    const daysSincePlanted = selectedPlant?.plantedAt
        ? Math.floor((new Date() - new Date(selectedPlant.plantedAt.replace(" ", "T"))) / (1000 * 60 * 60 * 24))
        : null;

    // 센서 기반 점수 계산
    const visionScore = calcVisionScore(device, sensorData);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-3">
                <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
                <span className="font-semibold text-gray-800 text-sm">{device.deviceNickname} 모니터링</span>
                <span className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: sseConnected ? "#22c55e" : "#f59e0b" }}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${sseConnected ? "bg-green-500 animate-pulse" : "bg-yellow-400"}`} />
                    {sseConnected ? "실시간 연결" : "재연결 중..."}
                </span>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-screen-xl mx-auto lg:items-start">

                {/* 좌측 사이드바 */}
                <div className="lg:col-span-3 flex flex-col gap-3">

                    {/* 식물 정보 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">{emoji}</div>
                            <div>
                                <div className="font-bold text-gray-800 text-sm">{representativePlant?.species || "미등록"}</div>
                                <div className="text-xs text-gray-400">{serialNumber} · 포트 {selectedPort + 1}</div>
                            </div>
                        </div>
                        {selectedPlant ? (
                            <div className="flex flex-col gap-2 text-xs">
                                {[
                                    { label: "재배 일수", value: daysSincePlanted !== null ? `${daysSincePlanted}일차` : "-" },
                                    { label: "생육 단계", value: STAGE_LABEL[selectedPlant.plantStage] || selectedPlant.plantStage },
                                    { label: "종류", value: selectedPlant.species || "-" },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                                        <span className="text-gray-400">{label}</span>
                                        <span className="font-medium text-gray-700">{value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-2">이 포트에 식물이 없어요</p>
                        )}
                    </div>

                    {/* Vision AI 분석 — 센서 기반 실시간 점수 + AI 파싱 결과 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🔍</span>
                                <h2 className="text-sm font-semibold text-gray-700">Vision AI 분석</h2>
                            </div>
                            {/* Vision AI 전용 새로고침 버튼 */}
                            <button
                                onClick={() => handleRefreshVision(device, selectedPlant)}
                                disabled={visionAiLoading}
                                className="text-[10px] text-green-600 hover:text-green-700 font-medium disabled:text-gray-300 transition-colors"
                            >
                                {visionAiLoading ? "분석 중..." : "↻ 새로고침"}
                            </button>
                        </div>

                        {/* 센서 기반 점수 — 항상 표시 */}
                        <div className="flex items-center gap-3 mb-3 p-2.5 bg-gray-50 rounded-xl">
                            <div className="relative w-12 h-12 flex-shrink-0">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="15.9" fill="none"
                                        stroke={visionScore.score >= 80 ? "#22c55e" : visionScore.score >= 55 ? "#f59e0b" : "#ef4444"}
                                        strokeWidth="3"
                                        strokeDasharray={`${visionScore.score} 100`}
                                        strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                                    {visionScore.score}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-700">{visionScore.grade}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">종합 건강 점수</p>
                                {visionScore.issues.length > 0 && (
                                    <p className="text-[10px] text-yellow-500 mt-0.5">
                                        ⚠ {visionScore.issues.slice(0, 2).join(", ")}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 생육 상태 / 질병 위험 — Vision AI 로딩 상태 사용 */}
                        {visionAiLoading ? (
                            <div className="flex flex-col gap-2">
                                {["생육 상태", "질병 위험"].map(label => (
                                    <div key={label} className="flex justify-between items-center py-1">
                                        <span className="text-xs text-gray-400">{label}</span>
                                        <span className="w-16 h-3 bg-gray-100 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 text-xs">
                                <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                    <span className="text-gray-400">생육 상태</span>
                                    <span className={`font-medium ${
                                        visionScore.growthStatus === "정상" ? "text-green-500" :
                                        visionScore.growthStatus === "주의" ? "text-yellow-500" : "text-red-500"
                                    }`}>
                                        {visionScore.growthStatus === "정상" ? "✓ " : "⚠ "}
                                        {visionScore.growthStatus}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-gray-400">질병 위험</span>
                                    <span className={`font-medium ${
                                        visionScore.diseaseRisk === "낮음" ? "text-green-500" :
                                        visionScore.diseaseRisk === "보통" ? "text-yellow-500" : "text-red-500"
                                    }`}>
                                        {visionScore.diseaseRisk === "낮음" ? "✓ " : "⚠ "}
                                        {visionScore.diseaseRisk}
                                    </span>
                                </div>
                                {/* AI가 파싱한 생육 요약이 있으면 한 줄 표시 */}
                                {aiAnalysis?.growth && <GrowthSummary text={aiAnalysis.growth} />}
                            </div>
                        )}
                    </div>

                    {/* 최근 알림 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🔔</span>
                                <h2 className="text-sm font-semibold text-gray-700">최근 알림</h2>
                            </div>
                            {notices.length > 0 && (
                                <span className="text-[10px] bg-green-100 text-green-600 font-semibold px-2 py-0.5 rounded-full">
                                    {notices.length}
                                </span>
                            )}
                        </div>
                        <div className="min-h-[230px] flex flex-col">
                            {notices.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
                                    <span className="text-2xl">🔕</span>
                                    <p className="text-xs">새로운 알림이 없어요</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-3 text-xs text-gray-500 overflow-y-auto max-h-[250px] pr-1">
                                        {notices.slice(0, noticeVisibleCount).map(notice => (
                                            <div key={notice.id}
                                                className={`border-l-2 pl-2 py-0.5 ${notice.isRead ? "border-gray-200" : "border-green-400"}`}>
                                                <p className="font-medium text-gray-700">{notice.noticeType}</p>
                                                <p className="mt-0.5 leading-relaxed">{notice.message}</p>
                                                <p className="text-gray-300 mt-0.5">{notice.deviceSerial}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {noticeVisibleCount < notices.length && (
                                        <button onClick={() => setNoticeVisibleCount(prev => prev + 10)}
                                            className="mt-3 w-full text-xs text-gray-400 hover:text-green-600 py-1.5 border border-dashed border-gray-200 hover:border-green-300 rounded-lg transition-colors">
                                            더보기 ({notices.length - noticeVisibleCount}개 남음)
                                        </button>
                                    )}
                                    {noticeVisibleCount > 10 && (
                                        <button onClick={() => setNoticeVisibleCount(10)}
                                            className="mt-1 w-full text-xs text-gray-300 hover:text-gray-500 py-1 transition-colors">
                                            접기
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 중앙 콘텐츠 */}
                <div className="lg:col-span-6 flex flex-col gap-4">

                    {/* 온도/습도 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium tracking-widest">TEMPERATURE</span>
                                <span className="text-xl">🌡️</span>
                            </div>
                            <div className={`text-3xl sm:text-4xl font-bold transition-colors ${tempOk ? "text-green-500" : temp !== null ? "text-yellow-500" : "text-gray-300"}`}>
                                {temp !== null && temp !== undefined ? `${temp}°C` : "-"}
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                                {tempOk ? "✓ 적정 범위" : temp !== null ? "⚠ 범위 벗어남" : "데이터 없음"}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium tracking-widest">HUMIDITY</span>
                                <span className="text-xl">💧</span>
                            </div>
                            <div className={`text-3xl sm:text-4xl font-bold transition-colors ${humidOk ? "text-green-500" : humidity !== null ? "text-yellow-500" : "text-gray-300"}`}>
                                {humidity !== null && humidity !== undefined ? `${humidity}%` : "-"}
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                                {humidOk ? "✓ 정상" : humidity !== null ? "⚠ 확인 필요" : "데이터 없음"}
                            </div>
                        </div>
                    </div>

                    {/* 양액 시스템 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">📊 양액 시스템 모니터링</h2>
                        <div className="grid grid-cols-3 gap-4">
                            {/* WATER */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="relative w-14 sm:w-16 h-14 sm:h-16 rounded-full overflow-hidden"
                                    style={{
                                        border: !waterHasData ? "4px solid #e5e7eb" : waterOk ? "4px solid #93c5fd" : "4px solid #fca5a5",
                                        background: !waterHasData ? "#f9fafb" : waterOk ? "#eff6ff" : "#fef2f2",
                                    }}>
                                    {waterOk && (
                                        <>
                                            <div style={{ position: "absolute", bottom: 0, left: "-50%", width: "200%", height: "55%", background: "rgba(96,165,250,0.4)", borderRadius: "40%", animation: "wave1 2.4s ease-in-out infinite" }} />
                                            <div style={{ position: "absolute", bottom: 0, left: "-50%", width: "200%", height: "50%", background: "rgba(59,130,246,0.55)", borderRadius: "38%", animation: "wave2 2s ease-in-out infinite" }} />
                                        </>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="text-xs font-bold" style={{ color: !waterHasData ? "#d1d5db" : waterOk ? "#1d4ed8" : "#ef4444" }}>
                                            {!waterHasData ? "-" : waterOk ? "있음" : "없음"}
                                        </span>
                                    </div>
                                    <style>{`
                                        @keyframes wave1 { 0%{transform:translateX(0) rotate(0deg)} 50%{transform:translateX(8%) rotate(5deg)} 100%{transform:translateX(0) rotate(0deg)} }
                                        @keyframes wave2 { 0%{transform:translateX(0) rotate(0deg)} 50%{transform:translateX(-8%) rotate(-5deg)} 100%{transform:translateX(0) rotate(0deg)} }
                                    `}</style>
                                </div>
                                <span className="text-xs text-gray-400">WATER</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${!waterHasData ? "bg-gray-100 text-gray-300" : waterOk ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-500"}`}>
                                    {!waterHasData ? "-" : waterOk ? "정상" : "부족"}
                                </span>
                            </div>
                            {/* PH */}
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors ${phOk ? "border-green-100 bg-green-50" : ph !== null ? "border-yellow-100 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                                    <span className={`text-base sm:text-lg font-bold transition-colors ${phOk ? "text-green-600" : ph !== null ? "text-yellow-600" : "text-gray-300"}`}>
                                        {ph ?? "-"}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">PH LEVEL</span>
                                <span className={`text-xs font-medium ${phOk ? "text-green-500" : ph !== null ? "text-yellow-500" : "text-gray-300"}`}>
                                    {ph !== null ? (phOk ? "적정" : "조정 필요") : "-"}
                                </span>
                            </div>
                            {/* TDS */}
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors ${tdsOk ? "border-purple-100 bg-purple-50" : tds !== null ? "border-yellow-100 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                                    <span className={`text-base sm:text-lg font-bold transition-colors ${tdsOk ? "text-purple-600" : tds !== null ? "text-yellow-600" : "text-gray-300"}`}>
                                        {tds !== null ? Math.round(tds) : "-"}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">TDS (PPM)</span>
                                <span className={`text-xs font-medium ${tdsOk ? "text-green-500" : tds !== null ? "text-yellow-500" : "text-gray-300"}`}>
                                    {tds !== null ? (tdsOk ? "정상" : "확인 필요") : "-"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 생육 변화 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-gray-700">📈 생육 변화</h2>
                            <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                    <span className="inline-block w-5 h-0.5 bg-green-500 rounded" />실제
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                    <span className="inline-block w-5 border-t-2 border-dashed border-green-400" />예측
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-1 mb-3 flex-wrap">
                            {PORT_OPTIONS.map(port => {
                                const portPlant = device.plants?.find(p => p.portIndex === port);
                                const isPortOn = portStatus[port] === "1";
                                return (
                                    <button key={port} onClick={() => setSelectedPort(port)}
                                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors border ${
                                            selectedPort === port
                                                ? "bg-green-600 text-white border-green-600"
                                                : isPortOn && portPlant
                                                    ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                                    : "bg-gray-50 text-gray-300 border-gray-100"
                                        }`}>
                                        {isPortOn && portPlant
                                            ? `${port + 1} ${SPECIES_EMOJI[portPlant.species] || "🌱"}`
                                            : `${port + 1}`}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="text-xs text-gray-400 mb-2">
                            포트 {selectedPort + 1} · {selectedPlant ? selectedPlant.name : "식물 미등록"}
                            <span className={`ml-2 font-medium ${portStatus[selectedPort] === "1" ? "text-green-500" : "text-gray-300"}`}>
                                {portStatus[selectedPort] === "1" ? "● ON" : "○ OFF"}
                            </span>
                        </div>

                        <GrowthTimelineChart selectedPlant={selectedPlant} prediction={prediction} />
                    </div>
                </div>

                {/* 우측 제어판 */}
                <div className="lg:col-span-3 flex flex-col gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">⚙️ 시스템 제어</h2>

                        {/* LED */}
                        <div className="mb-4 pb-4 border-b border-gray-50">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-gray-600">💡 LED 조명</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-medium ${!isLedAuto ? "text-gray-700" : "text-gray-300"}`}>수동</span>
                                    <div onClick={() => handleLedModeToggle(!isLedAuto)}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isLedAuto ? "bg-green-500" : "bg-gray-300"}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${isLedAuto ? "left-5" : "left-0.5"}`} />
                                    </div>
                                    <span className={`text-[10px] font-medium ${isLedAuto ? "text-green-600" : "text-gray-300"}`}>자동</span>
                                </div>
                            </div>
                            {!isLedAuto && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleLedManual(true)} disabled={ledSaving}
                                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${isLedOn ? "bg-yellow-400 border-yellow-400 text-white" : "bg-gray-50 border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-yellow-500"}`}>
                                        ☀️ ON
                                    </button>
                                    <button onClick={() => handleLedManual(false)} disabled={ledSaving}
                                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${!isLedOn ? "bg-gray-400 border-gray-400 text-white" : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"}`}>
                                        🌙 OFF
                                    </button>
                                </div>
                            )}
                            {isLedAuto && (
                                <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-400">시작 시간</label>
                                            <input type="time" value={ledStart} onChange={e => setLedStart(e.target.value)}
                                                className="w-full border border-gray-100 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 mt-1" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">종료 시간</label>
                                            <input type="time" value={ledEnd} onChange={e => setLedEnd(e.target.value)}
                                                className="w-full border border-gray-100 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 mt-1" />
                                        </div>
                                    </div>
                                    <button onClick={handleLedScheduleSave} disabled={ledSaving}
                                        className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                                        {ledSaving ? "저장 중..." : "스케줄 적용"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 촬영 주기 */}
                        <div className="mb-4 pb-4 border-b border-gray-50">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-gray-600">📷 촬영 주기</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <select value={captureInterval} onChange={e => setCaptureInterval(Number(e.target.value))}
                                    className="w-full border border-gray-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400">
                                    <option value={1}>1시간</option>
                                    <option value={3}>3시간</option>
                                    <option value={6}>6시간</option>
                                    <option value={12}>12시간</option>
                                    <option value={24}>24시간</option>
                                </select>
                                <button onClick={handleCaptureSave} disabled={captureSaving}
                                    className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                                    {captureSaving ? "저장 중..." : "주기 적용"}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed mt-2">
                                설정된 주기마다 타워가 360° 회전하면서 전체 식물을 촬영합니다.
                            </p>
                        </div>

                        {saveMessage && (
                            <div className={`text-xs text-center mb-2 font-medium ${saveMessage.startsWith("⚠") ? "text-yellow-500" : "text-green-600"}`}>
                                {saveMessage}
                            </div>
                        )}
                        <button onClick={handleResetSettings}
                            className="w-full border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm py-2.5 rounded-xl transition-colors">
                            설정 초기화
                        </button>
                    </div>

                    {/* AI 재배 조언 */}
                    <div className="bg-green-50 rounded-2xl border border-green-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🤖</span>
                                <h2 className="text-sm font-semibold text-green-700">AI 재배 조언</h2>
                            </div>
                            {/* AI 재배 조언 전용 새로고침 버튼 */}
                            <button
                                onClick={() => handleRefreshAdvice(device, selectedPlant)}
                                disabled={adviceAiLoading}
                                className="text-xs text-green-600 hover:text-green-800 disabled:text-green-300 underline transition-colors"
                            >
                                새로고침
                            </button>
                        </div>
                        {adviceAiLoading ? (
                            <div className="flex items-center justify-center py-6 text-green-600 text-xs gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                AI가 분석 중이에요...
                            </div>
                        ) : aiAdvice ? (
                            <div className="max-h-63 overflow-y-auto pr-1">
                                <p className="text-xs text-green-800 leading-relaxed whitespace-pre-wrap">{aiAdvice}</p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-4">조언을 불러올 수 없어요</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MonitoringPage;