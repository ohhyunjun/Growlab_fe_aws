import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { getUserDevicesApi, updateLedApi, updatePhotoIntervalApi } from "../../api/deviceApi";
import { getAllNoticesApi } from "../../api/noticeApi";
import { getSseStreamUrl } from "../../api/sensorApi";

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const STAGE_LABEL = { SEED: "씨앗", GERMINATION: "발아", MATURE: "성숙" };

// sessionStorage 키: 새로고침 후에도 마지막 센서값 유지
const getSensorKey = (serial) => `growlab_sensor_${serial}`;
const getNoticeKey = (serial) => `growlab_notices_${serial}`;

const fetchAiAdvice = async (deviceData, plantData) => {
    try {
        const token = localStorage.getItem("token");
        const daysSincePlanted = plantData?.plantedAt
            ? Math.floor((new Date() - new Date(plantData.plantedAt)) / (1000 * 60 * 60 * 24))
            : null;

        const response = await fetch("http://localhost:8080/api/ai/advice", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                serialNumber: deviceData.serialNumber,
                speciesName: plantData?.species || null,
                temperature: deviceData.temperature,
                humidity: deviceData.humidity,
                ph: deviceData.ph,
                ec: deviceData.ec,
                waterLevel: deviceData.waterLevel,
                daysSincePlanted: daysSincePlanted,
                plantStage: plantData?.plantStage || null,
            })
        });
        const data = await response.json();
        return data.advice;
    } catch (err) {
        console.error("AI 조언 불러오기 실패:", err);
        return null;
    }
};

function MonitoringPage() {
    const { serialNumber } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // ── 디바이스 기본 정보
    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── 실시간 센서 데이터 (SSE) — sessionStorage로 새로고침 복원
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

    // ── SSE 연결 상태
    const [sseConnected, setSseConnected] = useState(false);
    const sseRef = useRef(null);
    const reconnectTimerRef = useRef(null);

    // ── 알림
    const [notices, setNotices] = useState(() => {
        try {
            const saved = sessionStorage.getItem(getNoticeKey(serialNumber));
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [noticeVisibleCount, setNoticeVisibleCount] = useState(10);

    // ── UI 상태
    const [range, setRange] = useState(14);
    const [selectedPort, setSelectedPort] = useState(0);
    const [aiAdvice, setAiAdvice] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const RANGE_OPTIONS = [7, 14, 30, 60];
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

    const growthDataMap = {
        0: [3,4,5,6,7,8,9,10,11,12,13,14],
        1: [5,5,6,6,7,7,8,8,9,9,10,10],
        2: [2,3,3,4,4,5,5,6,6,7,7,8],
        3: [10,11,12,13,14,15,16,17,18,19,20,21],
        4: [1,2,2,3,3,4,4,5,5,6,6,7],
        5: [7,8,8,9,9,10,10,11,11,12,12,13],
        6: [4,5,6,7,8,9,10,11,12,13,14,15],
        7: [6,6,7,7,8,8,9,9,10,10,11,11],
    };
    const growthData = growthDataMap[selectedPort] || [];
    const visibleData = growthData.slice(-range);

    // ── 1. 디바이스 정보 + 알림 초기 로드
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
                        if (onPortWithPlant) {
                            setSelectedPort(onPortWithPlant.portIndex);
                        } else {
                            const firstPlant = found.plants.reduce((a, b) =>
                                a.portIndex < b.portIndex ? a : b
                            );
                            setSelectedPort(firstPlant.portIndex);
                        }
                    }

                    // AI 조언 호출
                    setAiLoading(true);
                    const representativePlant = found.plants?.find(p => p.species) ?? null;
                    const advice = await fetchAiAdvice(found, representativePlant);
                    setAiAdvice(advice);
                    setAiLoading(false);
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

    // ── 2. SSE 연결 (센서 실시간)
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

    // ── 3. 알림 폴링 (60초마다 새 알림 prepend)
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

    // ── LED 제어 핸들러
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

    // ── 촬영 주기 핸들러
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

    // ── 센서값 (SSE 실시간)
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
        ? Math.floor((new Date() - new Date(selectedPlant.plantedAt)) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 상단 헤더 */}
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

                    {/* Vision AI */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">🔍</span>
                            <h2 className="text-sm font-semibold text-gray-700">Vision AI 분석</h2>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
                            {[
                                { label: "생육 상태", value: "✓ 정상", color: "text-green-500" },
                                { label: "병충해", value: "✓ 이상없음", color: "text-green-500" },
                                { label: "성장 속도", value: "+12% 빠름", color: "text-blue-500" },
                                { label: "종합 평가", value: "85점 / 우수", color: "text-green-500" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex justify-between items-center py-1">
                                    <span className="text-gray-400">{label}</span>
                                    <span className={`font-medium ${color}`}>{value}</span>
                                </div>
                            ))}
                        </div>
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

                            {/* WATER — 파란 원 + 물결 애니메이션 (있다/없다) */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="relative w-14 sm:w-16 h-14 sm:h-16 rounded-full overflow-hidden"
                                    style={{
                                        border: !waterHasData ? "4px solid #e5e7eb"
                                              : waterOk       ? "4px solid #93c5fd"
                                                              : "4px solid #fca5a5",
                                        background: !waterHasData ? "#f9fafb"
                                                  : waterOk       ? "#eff6ff"
                                                                  : "#fef2f2",
                                    }}>
                                    {waterOk && (
                                        <>
                                            <div style={{
                                                position: "absolute", bottom: 0, left: "-50%",
                                                width: "200%", height: "55%",
                                                background: "rgba(96,165,250,0.4)",
                                                borderRadius: "40%",
                                                animation: "wave1 2.4s ease-in-out infinite",
                                            }}/>
                                            <div style={{
                                                position: "absolute", bottom: 0, left: "-50%",
                                                width: "200%", height: "50%",
                                                background: "rgba(59,130,246,0.55)",
                                                borderRadius: "38%",
                                                animation: "wave2 2s ease-in-out infinite",
                                            }}/>
                                        </>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="text-xs font-bold"
                                            style={{ color: !waterHasData ? "#d1d5db" : waterOk ? "#1d4ed8" : "#ef4444" }}>
                                            {!waterHasData ? "-" : waterOk ? "있음" : "없음"}
                                        </span>
                                    </div>
                                    <style>{`
                                        @keyframes wave1 {
                                            0%   { transform: translateX(0)  rotate(0deg); }
                                            50%  { transform: translateX(8%) rotate(5deg); }
                                            100% { transform: translateX(0)  rotate(0deg); }
                                        }
                                        @keyframes wave2 {
                                            0%   { transform: translateX(0)   rotate(0deg);  }
                                            50%  { transform: translateX(-8%) rotate(-5deg); }
                                            100% { transform: translateX(0)   rotate(0deg);  }
                                        }
                                    `}</style>
                                </div>
                                <span className="text-xs text-gray-400">WATER</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                                    ${!waterHasData ? "bg-gray-100 text-gray-300"
                                      : waterOk    ? "bg-blue-100 text-blue-600"
                                                   : "bg-red-100 text-red-500"}`}>
                                    {!waterHasData ? "-" : waterOk ? "정상" : "부족"}
                                </span>
                            </div>

                            {/* PH */}
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors
                                    ${phOk ? "border-green-100 bg-green-50" : ph !== null ? "border-yellow-100 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                                    <span className={`text-base sm:text-lg font-bold transition-colors
                                        ${phOk ? "text-green-600" : ph !== null ? "text-yellow-600" : "text-gray-300"}`}>
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
                                <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors
                                    ${tdsOk ? "border-purple-100 bg-purple-50" : tds !== null ? "border-yellow-100 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                                    <span className={`text-base sm:text-lg font-bold transition-colors
                                        ${tdsOk ? "text-purple-600" : tds !== null ? "text-yellow-600" : "text-gray-300"}`}>
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

                    {/* 생육 변화 그래프 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-gray-700">📈 생육 변화</h2>
                            <div className="flex gap-1">
                                {RANGE_OPTIONS.map(day => (
                                    <button key={day} onClick={() => setRange(day)}
                                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                                            range === day ? "bg-green-100 text-green-600 font-bold" : "bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600"
                                        }`}>{day}일</button>
                                ))}
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
                        {selectedPlant ? (
                            <>
                                <div className="h-32 sm:h-36 flex items-end justify-between gap-1">
                                    {visibleData.map((v, i) => (
                                        <div key={i} className="flex-1 bg-green-100 rounded-t-sm hover:bg-green-400 transition-colors"
                                            style={{ height: `${v * 2}px` }} />
                                    ))}
                                </div>
                                <div className="flex justify-between text-xs text-gray-300 mt-1">
                                    <span>{range - 1}일 전</span>
                                    <span>{Math.floor(range / 2)}일 전</span>
                                    <span>오늘</span>
                                </div>
                            </>
                        ) : (
                            <div className="h-32 sm:h-36 flex items-center justify-center text-gray-300 text-sm">
                                이 포트에 등록된 식물이 없어요
                            </div>
                        )}
                    </div>
                </div>

                {/* 우측 제어판 */}
                <div className="lg:col-span-3 flex flex-col gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">⚙️ 시스템 제어</h2>

                        {/* LED 섹션 */}
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

                            {/* 수동: ON/OFF 즉시 전송 */}
                            {!isLedAuto && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleLedManual(true)} disabled={ledSaving}
                                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                                            isLedOn ? "bg-yellow-400 border-yellow-400 text-white"
                                                    : "bg-gray-50 border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-yellow-500"
                                        }`}>☀️ ON</button>
                                    <button onClick={() => handleLedManual(false)} disabled={ledSaving}
                                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                                            !isLedOn ? "bg-gray-400 border-gray-400 text-white"
                                                     : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                                        }`}>🌙 OFF</button>
                                </div>
                            )}

                            {/* 자동: 시간 설정 후 저장 */}
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

                    {/* AI 조언 */}
                    <div className="bg-green-50 rounded-2xl border border-green-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🤖</span>
                                <h2 className="text-sm font-semibold text-green-700">AI 재배 조언</h2>
                            </div>
                            <button
                                onClick={async () => {
                                    setAiLoading(true);
                                    const advice = await fetchAiAdvice(device, selectedPlant);
                                    setAiAdvice(advice);
                                    setAiLoading(false);
                                }}
                                className="text-xs text-green-600 hover:text-green-800 underline"
                            >
                                새로고침
                            </button>
                        </div>

                        {aiLoading ? (
                            <div className="flex items-center justify-center py-6 text-green-600 text-xs gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                AI가 분석 중이에요...
                            </div>
                        ) : aiAdvice ? (
                            <p className="text-xs text-green-800 leading-relaxed whitespace-pre-wrap">{aiAdvice}</p>
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