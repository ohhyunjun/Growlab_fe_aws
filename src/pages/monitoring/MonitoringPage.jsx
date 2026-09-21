import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { getUserDevicesApi, updateLedApi, updatePhotoIntervalApi } from "../../api/deviceApi";
import { getAllNoticesApi } from "../../api/noticeApi";
import { getLatestSensorApi } from "../../api/sensorApi";
import { getLatestPredictionApi } from "../../api/predictionApi";
import { getGrowthTrendApi } from "../../api/photoApi";
import { API_BASE } from "../../api/config";
import {
    finishMonitoringPerformanceRun,
    getActiveMonitoringPerformanceRun,
    markMonitoringPerformance,
    measureMonitoringApi,
} from "../../utils/monitoringPerformance";
import { resolveRanges, isInRange, scoreSensor } from "../../utils/sensorRange";

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const getSensorKey = (serial) => `growlab_sensor_${serial}`;
const getNoticeKey = (serial) => `growlab_notices_${serial}`;

// ── AI 조언 API 호출 ──────────────────────────────────────────
const fetchAiData = async (deviceData, plantData) => {
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
                speciesId: deviceData.speciesId ?? null,
                speciesName: (
                    plantData?.species
                    || plantData?.speciesName
                    || deviceData.speciesName
                    || null
                ),
                temperature: deviceData.temperature,
                humidity: deviceData.humidity,
                ph: deviceData.ph,
                ec: deviceData.ec,
                waterLevel: deviceData.waterLevel,
                daysSincePlanted,
                plantStage: plantData?.stageName || plantData?.plantStage || null,
            })
        });
        const data = await response.json();
        return data.advice || null;
    } catch {
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

// ── 포트 단위 건강 진단 (하이브리드) ─────────────────────────────
// 기기 공통 환경 점수(base)를 바탕에 깔고, 선택 포트의 사진 신호로 가감한다:
//  · 질병 검출(plant.diseaseResult) → 큰 감점 + 질병 위험 '높음'
//  · 또래 대비 성장 격차(trend.gapPercent) → 정체면 감점, 크게 앞서면 소폭 가점
// 사진 신호(성장 곡선/질병)가 전혀 없으면 가짜 점수 대신 '진단 대기'로 표시한다.
const calcPortHealth = (base, plant, trend) => {
    if (!plant) return { portDataAvailable: false, reason: "no_plant" };
    const diseased = isDiseased(plant.diseaseResult);
    const gap = trend?.gapPercent;                                  // 또래 대비 %, null 가능
    const hasGrowth = Array.isArray(trend?.points) && trend.points.length > 0;
    if (!diseased && !hasGrowth) return { portDataAvailable: false, reason: "no_vision" };

    let score = base.score;
    const issues = [...(base.issues || [])];
    if (diseased) { score -= 35; issues.unshift(`질병 의심(${plant.diseaseResult})`); }
    if (gap != null) {
        if (gap <= -15) {
            // 격차가 클수록 더 감점 (−15%→15점, 상한 35점). 환경이 좋아도 성장 정체는 뚜렷이 반영.
            const pen = Math.min(35, 15 + (Math.abs(gap) - 15) * 0.3);
            score -= pen;
            issues.unshift(`성장 정체 ${gap}%`);
        }
        else if (gap <= -5) { score -= 7; }
        else if (gap >= 10) { score += 3; }
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    const grade = score >= 95 ? "S" : score >= 85 ? "A" : score >= 75 ? "B" : score >= 65 ? "C" : "D";
    let growthStatus = score >= 85 ? "정상" : score >= 65 ? "주의" : "위험";
    if ((diseased || (gap != null && gap <= -15)) && growthStatus === "정상") growthStatus = "주의";
    const diseaseRisk = diseased ? "높음" : (gap != null && gap <= -15) ? "보통" : base.diseaseRisk;

    return { portDataAvailable: true, score, grade, growthStatus, diseaseRisk, issues };
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
const parseDate = (value) => {
    if (!value) return null;
    const normalized = String(value).replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
    const date = value instanceof Date ? value : new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
};

// 서버는 선택한 식물의 다음 단계 하나를 예측한다. 다른 단계의 결과는 재사용하지 않는다.
const getNextStageForecast = (plant, prediction, stageNames, stageDurationDays = []) => {
    const plantedAt = parseDate(plant?.plantedAt);
    const currentStage = Number(plant?.stageIndex ?? 0);
    if (!plantedAt || !Number.isInteger(currentStage) || currentStage < 0
        || currentStage >= stageNames.length - 1) return null;

    const stage = currentStage + 1;
    const startDay = stageDurationDays[stage];
    let baselineDate = null;
    if (startDay !== null && startDay !== undefined && Number.isFinite(Number(startDay)) && Number(startDay) >= 0) {
        baselineDate = new Date(plantedAt);
        baselineDate.setDate(baselineDate.getDate() + Number(startDay));
    }

    const pointDate = parseDate(prediction?.expectedAt);
    const rangeStart = parseDate(prediction?.rangeStartAt);
    const rangeEnd = parseDate(prediction?.rangeEndAt);
    const validPrediction = prediction?.plantId != null && String(prediction.plantId) === String(plant.id)
        && Number(prediction?.predictedStage) === stage
        && pointDate && rangeStart && rangeEnd
        && rangeStart >= plantedAt && rangeStart <= pointDate && pointDate <= rangeEnd;

    // 화면 주값은 항상 산술 참고 일정(품종 기준). AI 예측은 섀도로만 기록/표시하고 화면 날짜를 바꾸지 않는다.
    // (AI-Hub 자료에서만 검증됐고 GrowLab 성능은 미확인이라, 화면 날짜 보정은 자체 데이터 확인 후 결정)
    const refBaseline = parseDate(prediction?.baselineAt) || baselineDate;
    const shadow = validPrediction ? {
        date: pointDate,                              // AI expectedAt (섀도)
        range: { start: rangeStart, end: rangeEnd },  // AI 예측 범위 (섀도)
        mode: prediction.predictionMode,              // LIGHTGBM_AI / STATISTICAL_WARMUP / ...
    } : null;

    return {
        stage,
        stageLabel: stageNames[stage],
        baselineDate: refBaseline,
        pointDate: refBaseline,        // 화면 주값 = 산술 참고 일정 (AI 유무와 무관하게 항상)
        range: null,                   // 화면엔 산술만 (AI 범위는 섀도)
        aiReady: false,                // 화면 주값은 AI가 아님
        source: "품종 기준 일정",
        shadow,                        // AI 섀도 (검증용, 화면 날짜에 미반영)
    };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const fmtDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
const fmtReadableDate = (date) => `${date.getMonth() + 1}월 ${date.getDate()}일`;



const describeDateShift = (baselineDate, predictedDate) => {
    if (!baselineDate || !predictedDate) return null;
    const shiftDays = (predictedDate - baselineDate) / DAY_MS;
    if (Math.abs(shiftDays) < 0.05) return "평소 예상과 비슷해요";
    return `평소보다 ${Math.abs(shiftDays).toFixed(1)}일 ${shiftDays < 0 ? "빨라요" : "늦어요"}`;
};

function EmptyTimeline({ children }) {
    return (
        <div className="min-h-44 rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 flex items-center justify-center px-4 text-center text-sm text-gray-400">
            {children}
        </div>
    );
}

function GrowthTimelineChart({
    selectedPlant,
    prediction,
    speciesName,
    stageNames = ["씨앗", "발아", "수확"],
    stageDurationDays = [],
}) {
    const [hovered, setHovered] = useState(null);
    const availableStageNames = Array.isArray(stageNames) && stageNames.length > 0
        ? stageNames
        : ["씨앗", "발아", "수확"];
    const displayStageNames = availableStageNames;
    const lastStageIdx = displayStageNames.length - 1;

    if (!selectedPlant) {
        return <EmptyTimeline>이 포트에 등록된 식물이 없어요.</EmptyTimeline>;
    }

    const today = new Date();
    const plantedAt = parseDate(selectedPlant.plantedAt);
    const germinatedAt = parseDate(selectedPlant.germinatedAt);
    const maturedAt = parseDate(selectedPlant.maturedAt);
    if (!plantedAt) {
        return <EmptyTimeline>재배 시작일 정보가 없어요.</EmptyTimeline>;
    }

    const displaySpecies = speciesName || selectedPlant.speciesName || selectedPlant.species || "재배 식물";
    const serverStageIdx = Number(selectedPlant.stageIndex ?? 0);
    const currentStageIdx = Number.isInteger(serverStageIdx)
        ? Math.min(lastStageIdx, Math.max(0, serverStageIdx)) : 0;
    const activeForecast = getNextStageForecast(
        { ...selectedPlant, stageIndex: currentStageIdx }, prediction, displayStageNames, stageDurationDays,
    );
    const shadowShift = activeForecast?.shadow
        ? describeDateShift(activeForecast.baselineDate, activeForecast.shadow.date) : null;
    const rangeText = (range) => range ? `${fmtDate(range.start)} ~ ${fmtDate(range.end)}` : "-";
    const endCandidates = [
        today, maturedAt, activeForecast?.pointDate, activeForecast?.range?.end, addDays(today, 7),
    ].filter(Boolean);
    const endDate = new Date(Math.max(...endCandidates.map((date) => date.getTime())));
    const totalMs = Math.max(endDate - plantedAt, DAY_MS);

    const W = 720;
    const H = Math.max(208, displayStageNames.length * 38 + 68);
    const PAD = { top: 34, bottom: 34, left: 80, right: 24 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;
    const cx = (date) => {
        const raw = PAD.left + ((date - plantedAt) / totalMs) * CW;
        return Math.min(W - PAD.right, Math.max(PAD.left, raw));
    };
    const cy = (stage) => PAD.top + CH - (stage / Math.max(lastStageIdx, 1)) * CH;
    const stageBandHeight = Math.min(28, Math.max(16, (CH / Math.max(lastStageIdx, 1)) * 0.42));

    const actualPoints = [{ date: plantedAt, stage: 0, label: displayStageNames[0] }];
    // 현재 도메인에서 기록한 두 번째/마지막 단계 시각만 사용한다. 중간 날짜는 추정하지 않는다.
    if (germinatedAt && currentStageIdx >= 1 && lastStageIdx > 1) {
        actualPoints.push({ date: germinatedAt, stage: 1, label: displayStageNames[1] });
    }
    if (maturedAt && currentStageIdx === lastStageIdx && lastStageIdx > 0) {
        actualPoints.push({ date: maturedAt, stage: lastStageIdx, label: displayStageNames[lastStageIdx] });
    } else {
        actualPoints.push({ date: today, stage: currentStageIdx, label: "오늘" });
    }

    const expectedPoints = activeForecast?.pointDate ? [
        { date: today, stage: currentStageIdx, label: "오늘" },
        { date: activeForecast.pointDate, stage: activeForecast.stage, label: `${activeForecast.stageLabel} 예상` },
    ] : [];

    const makePath = (points) => points.map((point, index) => (
        `${index === 0 ? "M" : "L"}${cx(point.date).toFixed(1)},${cy(point.stage).toFixed(1)}`
    )).join(" ");

    return (
        <section className="border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-xs font-semibold text-gray-700">예측 타임라인</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-gray-500 sm:flex sm:flex-wrap sm:items-center">
                    <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-0.5 w-5 rounded bg-green-600" />
                        실제 기록
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-5 border-t-2 border-dashed border-blue-400" />
                        중앙 예상
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-5 rounded-full bg-amber-200" />
                        예상 범위
                    </span>
                </div>
            </div>

            {activeForecast ? (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 sm:text-[10px]">
                                {activeForecast.stageLabel} 예상일
                            </p>
                            <p className={`mt-0.5 text-sm font-bold ${
                                activeForecast.aiReady ? "text-blue-600" : "text-gray-800"
                            }`}>
{activeForecast.pointDate ? fmtReadableDate(activeForecast.pointDate) : "예측 대기"}
                            </p>
                        </div>
                        <span className="hidden h-8 w-px bg-gray-200 sm:block" />
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 sm:text-[10px]">
                                AI 섀도 (검증 중 · 화면 미반영)
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-gray-500 sm:text-sm">
{activeForecast.shadow?.date
                                    ? fmtReadableDate(activeForecast.shadow.date)
                                    : "센서 이력 수집 중"}
                            </p>
                        </div>
                        <span className={`ml-auto rounded-full px-2 py-1 text-[9px] font-semibold sm:text-[10px] ${
                            activeForecast.aiReady
                                ? "bg-blue-50 text-blue-600"
                                : "bg-white text-gray-500 ring-1 ring-gray-200"
                        }`}>
{activeForecast.source}
                        </span>
                    </div>
                    <p className="mt-2 border-t border-gray-200/70 pt-2 text-[10px] leading-relaxed text-gray-400">
                        {activeForecast.baselineDate
                            ? `품종 기준 참고 일정 ${fmtReadableDate(activeForecast.baselineDate)}` : "품종 기준 일정이 아직 없어요."}
                        {shadowShift ? ` · AI 섀도는 ${shadowShift}로 보지만 화면 날짜엔 반영하지 않아요` : ""}
                        {activeForecast.shadow ? "" : " · AI 섀도는 센서 이력이 쌓이면 표시해요."}
                    </p>
                </div>
            ) : (
                <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-[10px] font-medium text-green-700 sm:text-xs">
                    마지막 생육 단계 · 다음 단계 예측 없음
                </div>
            )}

            <div className="mt-2 w-full overflow-x-auto sm:overflow-visible">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    style={{ width: "100%", minWidth: 420 }}
                    onMouseLeave={() => setHovered(null)}
                    role="img"
aria-label={`${displaySpecies}의 생육 단계와 다음 단계 예상 날짜 그래프`}
                >
                    <defs>
                        <filter id="growth-tip-shadow">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
                        </filter>
                    </defs>

                    {displayStageNames.map((stageName, stage) => (
                        <g key={stage}>
                            <rect
                                x={PAD.left}
                                y={cy(stage) - stageBandHeight / 2}
                                width={CW}
                                height={stageBandHeight}
                                rx="10"
                                fill="#f8fafc"
                            />
                            <line
                                x1={PAD.left}
                                y1={cy(stage)}
                                x2={W - PAD.right}
                                y2={cy(stage)}
                                stroke="#e8edf3"
                                strokeWidth="1"
                            />
                            <text
                                x={PAD.left - 11}
                                y={cy(stage)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize="11"
                                fill="#6b7280"
                                fontWeight="600"
                            >
                                {stageName}
                            </text>
                        </g>
                    ))}

                    {activeForecast?.range && (
                        <rect
                            x={cx(activeForecast.range.start)}
                            y={cy(activeForecast.stage) - 9}
                            width={Math.max(3, cx(activeForecast.range.end) - cx(activeForecast.range.start))}
                            height="18"
                            rx="9"
                            fill="#fbbf24"
                            opacity="0.24"
                        >
                            <title>{`${activeForecast.stageLabel} 예상 범위 ${rangeText(activeForecast.range)}`}</title>
                        </rect>
                    )}

                    <path
                        d={makePath(actualPoints)}
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {expectedPoints.length > 1 && (
                        <path
                            d={makePath(expectedPoints)}
                            fill="none"
                            stroke="#60a5fa"
                            strokeWidth="2.5"
                            strokeDasharray="7 5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    )}

                    <line
                        x1={cx(today)}
                        y1={PAD.top - 27}
                        x2={cx(today)}
                        y2={H - PAD.bottom + 7}
                        stroke="#15803d"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity="0.65"
                    />
                    <rect x={cx(today) - 19} y={4} width="38" height="19" rx="9.5" fill="#15803d" />
                    <text
                        x={cx(today)}
                        y={14}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="9"
                        fill="white"
                        fontWeight="700"
                    >
                        오늘
                    </text>

                    {actualPoints.map((point, index) => (
                        <g
                            key={`actual-${point.label}-${index}`}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHovered({ ...point, type: "실제 기록" })}
                        >
                            <circle
                                cx={cx(point.date)}
                                cy={cy(point.stage)}
                                r={point.label === "오늘" ? 6 : 5}
                                fill={point.label === "오늘" ? "#15803d" : "#22c55e"}
                                stroke="white"
                                strokeWidth="2"
                            />
                            {point.stage > 0 && point.label !== "오늘" && (
                                <text
                                    x={cx(point.date)}
                                    y={cy(point.stage) - 15}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill="#15803d"
                                    fontWeight="700"
                                >
                                    {`${point.label} ${fmtDate(point.date)}`}
                                </text>
                            )}
                        </g>
                    ))}

                    {expectedPoints.slice(1).map((point, index) => {
                        const pointX = cx(point.date);
                        const anchor = pointX > W - 120 ? "end" : "start";
                        const labelX = anchor === "end" ? pointX - 10 : pointX + 10;
                        return (
                            <g
                                key={`expected-${point.label}-${index}`}
                                style={{ cursor: "pointer" }}
                                onMouseEnter={() => setHovered({ ...point, type: "예상 날짜" })}
                            >
                                <circle
                                    cx={pointX}
                                    cy={cy(point.stage)}
                                    r="8"
                                    fill="white"
                                    stroke="#60a5fa"
                                    strokeWidth="2"
                                />
                                <circle cx={pointX} cy={cy(point.stage)} r="3" fill="#60a5fa" />
                                <text
                                    x={labelX}
                                    y={cy(point.stage) - 15}
                                    textAnchor={anchor}
                                    fontSize="9"
                                    fill="#2563eb"
                                    fontWeight="700"
                                >
                                    {`${point.label} ${fmtDate(point.date)}`}
                                </text>
                            </g>
                        );
                    })}

                    <text x={PAD.left} y={H - 12} fontSize="10" fill="#9ca3af">
                        {fmtDate(plantedAt)} 파종
                    </text>
                    <text x={W - PAD.right} y={H - 12} textAnchor="end" fontSize="10" fill="#9ca3af">
                        {fmtDate(endDate)}
                    </text>

                    {hovered && (() => {
                        const tx = cx(hovered.date);
                        const ty = cy(hovered.stage);
                        const flip = tx > W * 0.72;
                        const boxX = flip ? tx - 122 : tx + 12;
                        const boxY = Math.max(28, ty - 25);
                        return (
                            <g>
                                <rect
                                    x={boxX}
                                    y={boxY}
                                    width="110"
                                    height="45"
                                    rx="8"
                                    fill="white"
                                    stroke="#e5e7eb"
                                    filter="url(#growth-tip-shadow)"
                                />
                                <text
                                    x={boxX + 55}
                                    y={boxY + 16}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#374151"
                                    fontWeight="700"
                                >
                                    {hovered.label}
                                </text>
                                <text
                                    x={boxX + 55}
                                    y={boxY + 32}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill="#6b7280"
                                >
                                    {fmtDate(hovered.date)} · {hovered.type}
                                </text>
                            </g>
                        );
                    })()}
                </svg>
            </div>
        </section>
    );
}

// ── 확장 기능 공통 헬퍼 ───────────────────────────────────────
// 질병 라벨 판정 (BE isHealthyLabel과 동일: healthy/normal/정상/no_detection은 정상으로 본다)
const HEALTHY_LABELS = new Set(["", "no_detection", "healthy", "normal", "정상"]);
const isDiseased = (label) => {
    if (label == null) return false;
    return !HEALTHY_LABELS.has(String(label).trim().toLowerCase());
};

const HEALTH_COLOR = { good: "#22c55e", warn: "#f59e0b", bad: "#ef4444", empty: "#d1d5db" };

// 포트 점(dot) 색: 질병=빨강, 식물없음=회색, 그 외 초록. (성장정체 주의는 선택 포트 상세에서만 표시)
const portDotHealth = (plant) => {
    if (!plant) return "empty";
    if (isDiseased(plant.diseaseResult)) return "bad";
    return "good";
};

// 선택 포트의 종합 헬스 (질병 > 성장정체 > 정상)
const resolvePortHealth = (plant, gapPercent) => {
    if (!plant) return "empty";
    if (isDiseased(plant.diseaseResult)) return "bad";
    if (gapPercent != null && gapPercent <= -15) return "warn";
    return "good";
};

// 다음 단계 예상 — 차트 대신 텍스트로 제공
function NextStageReadout({ selectedPlant, prediction, stageNames, stageDurationDays }) {
    if (!selectedPlant) {
        return <EmptyTimeline>이 포트에 식물이 없어요</EmptyTimeline>;
    }
    const currentStageIdx = Number(selectedPlant.stageIndex ?? 0);
    const isLastStage = currentStageIdx >= stageNames.length - 1;
    const forecast = getNextStageForecast(
        { ...selectedPlant, stageIndex: currentStageIdx }, prediction, stageNames, stageDurationDays,
    );
    const badges = stageNames.map((name, i) => {
        const state = i < currentStageIdx ? "done" : i === currentStageIdx ? "now" : "future";
        const cls = state === "done" ? "bg-green-500 text-white"
            : state === "now" ? "bg-green-100 text-green-700 ring-1 ring-green-400"
            : "bg-gray-200 text-gray-400";
        return { name, cls };
    });

    return (
        <div className="rounded-xl bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-gray-500">다음 단계 예상</span>
                <span className="text-[10px] text-gray-400 border border-dashed border-gray-300 rounded-full px-2 py-0.5">
                    {forecast ? forecast.source : "통계 기반 예상"}
                </span>
            </div>
            {isLastStage ? (
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-green-600">수확 적기</span>
                    <span className="text-xs text-gray-400 pb-1">마지막 단계예요</span>
                </div>
            ) : forecast?.pointDate ? (
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-gray-800">{fmtReadableDate(forecast.pointDate)}</span>
                    <span className="text-xs text-gray-400 pb-1.5">{forecast.stageLabel} 예상</span>
                </div>
            ) : (
                <div className="text-sm text-gray-400 py-2">예상 시점을 계산 중이에요</div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
                {badges.map((b, i) => (
                    <span key={b.name} className="inline-flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-medium ${b.cls}`}>{b.name}</span>
                        {i < badges.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                ))}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">품종 기준 + 이 포트 경과시간으로 계산 · 참고용</p>
        </div>
    );
}

// 성장 추이 SVG (이 포트 실선 + 또래 평균 점선). peer 값이 null이면 그 구간은 건너뛴다.
function GrowthTrendSvg({ points, peerPoints, color }) {
    const vals = (points || []).map(p => p?.value).filter(v => v != null);
    if (!vals.length) {
        return <div className="h-12 flex items-center text-[11px] text-gray-300">아직 관측 데이터가 없어요</div>;
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
            {peerPath && <path d={peerPath} fill="none" stroke="#9ca3af" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.7" />}
            <path d={selfPath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {lastV != null && <circle cx={(lastIdx * st).toFixed(1)} cy={Y(lastV).toFixed(1)} r="3" fill={color} />}
        </svg>
    );
}

// 성장 추이 카드 (성장추이 SVG + 또래 순위/격차)
function GrowthTrendCard({ trend, loading, color }) {
    const points = trend?.points ?? [];
    const peerPoints = trend?.peerPoints ?? [];
    const rank = trend?.rank ?? null;
    const portCount = trend?.portCount ?? null;
    const gap = trend?.gapPercent ?? null;
    const gapColor = gap == null ? "text-gray-400"
        : gap >= 5 ? "text-green-600" : gap <= -15 ? "text-red-500" : gap < 0 ? "text-yellow-600" : "text-gray-500";
    return (
        <div className="rounded-xl bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-gray-500">성장 추이 <span className="text-[9px] font-normal text-gray-400">관측</span></span>
                {rank != null && portCount ? <span className={`text-[11px] font-semibold ${gapColor}`}>{portCount}중 {rank}위</span> : null}
            </div>
            {loading ? (
                <div className="h-12 flex items-center text-[11px] text-gray-300">불러오는 중...</div>
            ) : (
                <GrowthTrendSvg points={points} peerPoints={peerPoints} color={color} />
            )}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: color }} />이 포트</span>
                <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-gray-400" />또래 평균</span>
                {gap != null && <span className={`ml-auto font-medium ${gapColor}`}>{gap > 0 ? "+" : ""}{gap}%</span>}
            </div>
        </div>
    );
}

// 현재 관측 요약 (크기/질병/순위/격차)
function PortObservation({ plant, trend }) {
    if (!plant) {
        return <div className="rounded-xl bg-gray-50 p-4 flex items-center justify-center text-[11px] text-gray-300">데이터 없음</div>;
    }
    const latest = trend?.latestRatio;
    const rank = trend?.rank, portCount = trend?.portCount, gap = trend?.gapPercent;
    const diseased = isDiseased(plant.diseaseResult);
    const items = [
        ["현재 크기", latest != null ? `${(latest * 100).toFixed(1)}%` : "-", "text-gray-700"],
        ["질병 검출", diseased ? plant.diseaseResult : "정상", diseased ? "text-red-500" : "text-gray-700"],
        ["또래 순위", rank != null && portCount ? `${portCount}중 ${rank}위` : "-", "text-gray-700"],
        ["성장 격차", gap != null ? `${gap > 0 ? "+" : ""}${gap}%` : "-",
            gap == null ? "text-gray-400" : gap >= 5 ? "text-green-600" : gap <= -15 ? "text-red-500" : gap < 0 ? "text-yellow-600" : "text-gray-500"],
    ];
    return (
        <div className="rounded-xl bg-gray-50 p-4 grid grid-cols-2 gap-2 content-start">
            {items.map(([k, v, c]) => (
                <div key={k}>
                    <div className="text-[10px] text-gray-400">{k}</div>
                    <div className={`text-sm font-semibold ${c}`}>{v}</div>
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
            const res = await fetch(`${API_BASE}/ai/port-diagnosis`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    serialNumber,
                    speciesId: speciesId ?? null,
                    speciesName: speciesName ?? null,
                    portIndex: plant.portIndex,
                    daysSincePlanted: daysSincePlanted ?? null,
                    plantStage: plant.plantStage ?? null,
                    gapPercent: trend?.gapPercent ?? null,
                    rank: trend?.rank ?? null,
                    portCount: trend?.portCount ?? null,
                    currentSizePercent: trend?.latestRatio != null ? Math.round(trend.latestRatio * 1000) / 10 : null,
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
                <span className="font-semibold text-[12.5px] text-gray-700">🤖 AI 정밀 포트 분석</span>
                <button onClick={runDiagnosis} disabled={llmLoading}
                    className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    {llmLoading ? "분석 중…" : llm ? "다시 분석" : "분석 요청"}
                </button>
            </div>

            {!llm && !llmLoading && !llmError && (
                <p className="mt-2 text-[11px] text-gray-400">‘분석 요청’을 누르면 이 포트의 센서·성장 데이터를 바탕으로 AI가 원인과 조치를 분석합니다.</p>
            )}
            {llmLoading && <p className="mt-2 text-[12px] text-gray-500">AI가 분석 중입니다…</p>}
            {llmError && <p className="mt-2 text-[11px] text-red-500">분석을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
            {llm && (
                <div className="mt-2">
                    <p className="text-[12px] text-gray-700 whitespace-pre-line leading-relaxed">{llm}</p>
                    <p className="mt-2 text-[9px] text-gray-400">생성형 AI 추정 · 확정 진단 아님</p>
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

    const [sensorConnected, setSensorConnected] = useState(false);

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
    const savedCaptureInterval = Number(saved?.captureInterval);
    const [captureInterval, setCaptureInterval] = useState(
        [1, 3, 6].includes(savedCaptureInterval) ? savedCaptureInterval : 6
    );
    const [saveMessage, setSaveMessage] = useState("");
    const [ledSaving, setLedSaving] = useState(false);
    const [captureSaving, setCaptureSaving] = useState(false);

    useEffect(() => {
        coreVisibleMarkedRef.current = false;
        firstSensorMarkedRef.current = false;
        performanceFinishedRef.current = false;
        markMonitoringPerformance(perfRunId, "monitoring_route_rendered");
    }, [serialNumber, perfRunId]);

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

    // ── 1. 디바이스 + 부가 데이터 로드
    useEffect(() => {
        const loadAiAdvice = async (found) => {
            if (!found) return;

            setVisionAiLoading(true);
            setAdviceAiLoading(true);

            try {
                const representativePlant = found.plants?.[0] ?? null;
                const advice = await measureMonitoringApi(
                    perfRunId,
                    "ai_advice",
                    () => fetchAiData(found, representativePlant)
                );
                setAiAdvice(advice);
                setAiAnalysis(parseAiAnalysis(advice));
                markMonitoringPerformance(perfRunId, "ai_advice_settled", {
                    hasAdvice: Boolean(advice),
                });
            } catch (e) {
                console.error("[AI advice]", e);
            } finally {
                setVisionAiLoading(false);
                setAdviceAiLoading(false);
            }
        };

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
                loadAiAdvice(found);
                loadNotices();
            } catch (e) {
                console.error("[Initial device]", e);
                setLoading(false);
                setNoticesSettled(true);
            }
        };
        fetchData();
    }, [serialNumber, perfRunId, targetPortIndex]);

    // ── 2. 예측 조회
    useEffect(() => {
        let cancelled = false;
        setPrediction(null);
        if (!device) return;
        const plant = device.plants?.find(p => p.portIndex === selectedPort);
        if (!plant) {
            setPrediction(null);
            setPredictionSettled(true);
            markMonitoringPerformance(perfRunId, "prediction_settled", { hasPlant: false });
            return;
        }
        setPredictionSettled(false);
        measureMonitoringApi(perfRunId, "prediction", () => getLatestPredictionApi(plant.id))
            .then(res => {
                if (!cancelled) setPrediction(res.data ? { plantId: plant.id, ...res.data } : null);
            })
            .catch(() => {
                if (!cancelled) setPrediction(null);
            })
            .finally(() => {
                if (cancelled) return;
                setPredictionSettled(true);
                markMonitoringPerformance(perfRunId, "prediction_settled", { hasPlant: true });
            });
        return () => { cancelled = true; };
    }, [device, selectedPort, perfRunId]);

    // ── 3. AWS API Gateway 호환 최신 센서값 폴링
    useEffect(() => {
        let cancelled = false;
        const refreshSensor = async () => {
            try {
                const response = await getLatestSensorApi(serialNumber);
                const data = response.data;
                if (cancelled || !data) return;
                if (!firstSensorMarkedRef.current) {
                    firstSensorMarkedRef.current = true;
                    markMonitoringPerformance(perfRunId, "sensor_first_value");
                }
                setSensorData(prev => {
                    const next = {
                        temperature: data.temperature ?? prev.temperature,
                        humidity: data.humidity ?? prev.humidity,
                        ph: data.ph ?? prev.ph,
                        tds: data.tds ?? prev.tds,
                        water_level_status: data.water_level_status ?? prev.water_level_status,
                    };
                    sessionStorage.setItem(getSensorKey(serialNumber), JSON.stringify(next));
                    return next;
                });
                setSensorConnected(true);
            } catch {
                if (!cancelled) setSensorConnected(false);
            }
        };
        refreshSensor();
        const timer = setInterval(refreshSensor, 5_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
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
            !visionAiLoading &&
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
        visionAiLoading,
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

    const handleResetSettings = () => {
        if (!window.confirm("설정을 초기화할까요?")) return;
        localStorage.removeItem(storageKey);
        setIsLedOn(true); setIsLedAuto(false);
        setLedStart("06:00"); setLedEnd("22:00");
        setCaptureInterval(6);
        setSaveMessage("✓ 초기화되었습니다");
        setTimeout(() => setSaveMessage(""), 2000);
    };

    // 선택 포트의 성장 추이(관측 크기) + 또래 비교. 성장추이 카드/현재관측/문제분석이 공유.
    const [growthTrend, setGrowthTrend] = useState(null);
    const [growthTrendLoading, setGrowthTrendLoading] = useState(false);
    useEffect(() => {
        const hasPlant = device?.plants?.some(p => p.portIndex === selectedPort);
        if (!serialNumber || !hasPlant) { setGrowthTrend(null); return; }
        let alive = true;
        setGrowthTrendLoading(true);
        getGrowthTrendApi(serialNumber, selectedPort)
            .then(res => { if (alive) setGrowthTrend(res.data); })
            .catch(() => { if (alive) setGrowthTrend(null); })
            .finally(() => { if (alive) setGrowthTrendLoading(false); });
        return () => { alive = false; };
    }, [serialNumber, selectedPort, device]);

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
    const ranges  = resolveRanges(device);
    const tempOk  = isInRange(temp, ranges.temp);
    const humidOk = isInRange(humidity, ranges.humidity);
    const phOk    = isInRange(ph, ranges.ph);
    const tdsOk   = isInRange(tds, ranges.tds);

    const portStatus = device.portStatus || "00000000";
    const selectedPlant = device.plants?.find(p => p.portIndex === selectedPort) ?? null;
    const representativePlant = device.plants?.[0] ?? null;
    const deviceSpeciesName = (
        device.speciesName
        || representativePlant?.speciesName
        || representativePlant?.species
        || null
    );
    const stageNames = Array.isArray(device.stageNames) && device.stageNames.length > 0
        ? device.stageNames
        : ["씨앗", "발아", "수확"];
    const emoji = SPECIES_EMOJI[deviceSpeciesName] || "🌱";
    const daysSincePlanted = selectedPlant?.plantedAt
        ? Math.floor((new Date() - new Date(selectedPlant.plantedAt.replace(" ", "T"))) / (1000 * 60 * 60 * 24))
        : null;

    // 센서 기반 점수 계산
    const visionScore = calcVisionScore(sensorData, ranges);
    // 포트 단위 건강 진단: 환경 점수(visionScore)를 바탕으로 선택 포트의 사진 신호(질병·성장격차) 반영
    const portHealth = calcPortHealth(visionScore, selectedPlant, growthTrend);

    const selectedHealth = resolvePortHealth(selectedPlant, growthTrend?.gapPercent);
    const selectedHealthColor = HEALTH_COLOR[selectedHealth];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── 고정: 네비 아래 상단바(실시간 연결). 내부는 네비와 동일 폭(max-w-7xl px-6) ── */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
                    <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
                    <span className="font-semibold text-gray-800 text-sm">{device.deviceNickname} 모니터링</span>
                    <span className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: sensorConnected ? "#22c55e" : "#f59e0b" }}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${sensorConnected ? "bg-green-500 animate-pulse" : "bg-yellow-400"}`} />
                        {sensorConnected ? "센서값 수신" : "센서값 확인 중..."}
                    </span>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-5">

                {/* ═══════════ 기기 공통 상태 ═══════════ */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🌐</span>
                    <h2 className="text-sm font-bold text-gray-700">기기 공통 상태</h2>
                    <span className="text-[11px] text-gray-400">장비 전체 적용 · 8포트 공통</span>
                    <div className="flex-1 border-t border-gray-200 ml-2" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* 온도 */}
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
                    {/* 습도 */}
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

                    {/* 양액 시스템 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm lg:col-span-2">
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

                    {/* 시스템 제어 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm lg:col-span-2">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">⚙️ 시스템 제어</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* LED */}
                            <div>
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
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-gray-600">📷 촬영 주기</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <select value={captureInterval} onChange={e => setCaptureInterval(Number(e.target.value))}
                                        className="w-full border border-gray-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400">
                                        <option value={1}>1시간</option>
                                        <option value={3}>3시간</option>
                                        <option value={6}>6시간</option>
                                    </select>
                                    <button onClick={handleCaptureSave} disabled={captureSaving}
                                        className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                                        {captureSaving ? "저장 중..." : "주기 적용"}
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed mt-2">
                                    주기마다 타워가 360° 회전하며 전체 식물을 촬영합니다.
                                </p>
                            </div>
                        </div>
                        {saveMessage && (
                            <div className={`text-xs text-center mt-3 font-medium ${saveMessage.startsWith("⚠") ? "text-yellow-500" : "text-green-600"}`}>
                                {saveMessage}
                            </div>
                        )}
                        <button onClick={handleResetSettings}
                            className="w-full mt-4 border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm py-2.5 rounded-xl transition-colors">
                            설정 초기화
                        </button>
                    </div>

                    {/* AI 재배 조언 */}
                    <div className="bg-green-50 rounded-2xl border border-green-100 p-4 lg:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🤖</span>
                                <h2 className="text-sm font-semibold text-green-700">AI 재배 조언</h2>
                            </div>
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

                    {/* 최근 알림 (전체폭) */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm lg:col-span-4">
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
                        {notices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 text-gray-300 py-8">
                                <span className="text-2xl">🔕</span>
                                <p className="text-xs">새로운 알림이 없어요</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-500">
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

                {/* ═══════════ 포트별 상세 ═══════════ */}
                <div className="flex items-center gap-2 mt-8 mb-3">
                    <span className="text-base">🔌</span>
                    <h2 className="text-sm font-bold text-gray-700">포트별 상세</h2>
                    <span className="text-[11px] text-gray-400">선택한 포트만 표시 · 포트마다 생육단계·상태 다름</span>
                    <div className="flex-1 border-t border-gray-200 ml-2" />
                </div>

                {/* 포트 선택기 (헬스 점) */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[11px] font-semibold text-gray-500">포트 선택</span>
                        <div className="flex flex-wrap gap-1.5">
                            {PORT_OPTIONS.map(port => {
                                const portPlant = device.plants?.find(p => p.portIndex === port);
                                const isPortOn = portStatus[port] === "1";
                                // BE 성장추이 응답의 포트별 상태(정상/주의/이상)를 우선 사용 → 성장정체 포트는 주황.
                                // 아직 안 불러왔으면 식물 기반(질병/빈포트/정상)으로 폴백. 추가 호출 없음.
                                const trendHealth = growthTrend?.ports?.find(x => x.portIndex === port)?.health;
                                const dot = trendHealth || portDotHealth(portPlant);
                                return (
                                    <button key={port} onClick={() => setSelectedPort(port)}
                                        aria-label={`포트 ${port + 1}${isPortOn && portPlant ? " 사용 중" : ""}`}
                                        className={`relative h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                                            selectedPort === port
                                                ? "border-green-600 bg-green-600 text-white shadow-sm"
                                                : isPortOn && portPlant
                                                    ? "border-green-200 bg-white text-green-700 hover:bg-green-50"
                                                    : "border-gray-100 bg-white text-gray-300"
                                        }`}>
                                        {port + 1}
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: HEALTH_COLOR[dot] }} />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-gray-400 sm:text-xs">
                            <strong className="text-gray-700">포트 {selectedPort + 1}</strong>
                            <span>·</span>
                            <span>{selectedPlant ? `${emoji} ${deviceSpeciesName || selectedPlant.name}` : "식물 미등록"}</span>
                            <span className={`font-semibold ${portStatus[selectedPort] === "1" ? "text-green-600" : "text-gray-300"}`}>
                                {portStatus[selectedPort] === "1" ? "● ON" : "○ OFF"}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />정상</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />주의(성장정체)</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />이상(질병)</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d1d5db" }} />빈 포트</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:items-start">
                    {/* 좌: 식물정보 + Vision AI */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        {/* 식물 정보 */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">{emoji}</div>
                                <div>
                                    <div className="font-bold text-gray-800 text-sm">{deviceSpeciesName || "미등록"}</div>
                                    <div className="text-xs text-gray-400">{serialNumber} · 포트 {selectedPort + 1}</div>
                                </div>
                            </div>
                            {selectedPlant ? (
                                <div className="flex flex-col gap-2 text-xs">
                                    {[
                                        { label: "재배 일수", value: daysSincePlanted !== null ? `${daysSincePlanted}일차` : "-" },
                                        {
                                            label: "생육 단계",
                                            value: selectedPlant.stageName
                                                || stageNames[Number(selectedPlant.stageIndex)]
                                                || selectedPlant.plantStage
                                                || "-",
                                        },
                                        { label: "품종", value: deviceSpeciesName || "-" },
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
                                    <h2 className="text-sm font-semibold text-gray-700">포트 건강 진단</h2>
                                </div>
                                <button
                                    onClick={() => handleRefreshVision(device, selectedPlant)}
                                    disabled={visionAiLoading}
                                    className="text-[10px] text-green-600 hover:text-green-700 font-medium disabled:text-gray-300 transition-colors"
                                >
                                    {visionAiLoading ? "분석 중..." : "↻ 새로고침"}
                                </button>
                            </div>

                            {!portHealth.portDataAvailable ? (
                                <div className="flex items-center gap-3 mb-1 p-3 bg-gray-50 rounded-xl">
                                    <span className="text-lg">🪴</span>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500">진단 대기</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            {portHealth.reason === "no_plant"
                                                ? "이 포트에 등록된 식물이 없어요."
                                                : "이 포트의 사진 데이터가 아직 없어요. 촬영이 쌓이면 진단됩니다."}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                            <>
                            <div className="flex items-center gap-3 mb-3 p-2.5 bg-gray-50 rounded-xl">
                                <div className="relative w-12 h-12 flex-shrink-0">
                                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.9" fill="none"
                                            stroke={portHealth.score >= 80 ? "#22c55e" : portHealth.score >= 55 ? "#f59e0b" : "#ef4444"}
                                            strokeWidth="3"
                                            strokeDasharray={`${portHealth.score} 100`}
                                            strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                                        {portHealth.score}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-700">{portHealth.grade}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">포트 {selectedPort + 1} 건강 점수</p>
                                    {portHealth.issues.length > 0 && (
                                        <p className="text-[10px] text-yellow-500 mt-0.5">
                                            ⚠ {portHealth.issues.slice(0, 2).join(", ")}
                                        </p>
                                    )}
                                </div>
                            </div>

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
                                            portHealth.growthStatus === "정상" ? "text-green-500" :
                                            portHealth.growthStatus === "주의" ? "text-yellow-500" : "text-red-500"
                                        }`}>
                                            {portHealth.growthStatus === "정상" ? "✓ " : "⚠ "}
                                            {portHealth.growthStatus}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-gray-400">질병 위험</span>
                                        <span className={`font-medium ${
                                            portHealth.diseaseRisk === "낮음" ? "text-green-500" :
                                            portHealth.diseaseRisk === "보통" ? "text-yellow-500" : "text-red-500"
                                        }`}>
                                            {portHealth.diseaseRisk === "낮음" ? "✓ " : "⚠ "}
                                            {portHealth.diseaseRisk}
                                        </span>
                                    </div>
                                    {aiAnalysis?.growth && <GrowthSummary text={aiAnalysis.growth} />}
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
                                <h2 className="text-sm font-semibold text-gray-700">📈 생육 상세</h2>
                                <p className="mt-0.5 text-[10px] text-gray-400">단계 기록·다음 예상 시점 · 이 포트의 성장 추이와 문제 분석.</p>
                            </div>

                            <NextStageReadout
                                selectedPlant={selectedPlant}
                                prediction={prediction}
                                stageNames={stageNames}
                                stageDurationDays={device.stageDurationDays || []}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <GrowthTrendCard trend={growthTrend} loading={growthTrendLoading} color={selectedHealthColor} />
                                <PortObservation plant={selectedPlant} trend={growthTrend} />
                            </div>

                            <PortProblemBlock plant={selectedPlant} trend={growthTrend}
                                serialNumber={serialNumber} speciesId={device?.speciesId ?? null}
                                speciesName={deviceSpeciesName} daysSincePlanted={daysSincePlanted} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MonitoringPage;
