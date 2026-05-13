import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserDevicesApi } from "../../api/deviceApi";
import { getAllNoticesApi } from "../../api/noticeApi";

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const STAGE_LABEL = { SEED: "씨앗", GERMINATION: "발아", MATURE: "성숙" };

function MonitoringPage() {
    const { serialNumber } = useParams();
    const navigate = useNavigate();
    const [device, setDevice] = useState(null);
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState(14);
    const [selectedPort, setSelectedPort] = useState(0);
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

    const [autoCapture, setAutoCapture] = useState(saved?.autoCapture ?? false);
    const [isLedOn, setIsLedOn] = useState(saved?.isLedOn ?? true);
    const [rotationAngle, setRotationAngle] = useState(saved?.rotationAngle ?? 0);
    const [cameraHeight, setCameraHeight] = useState(saved?.cameraHeight ?? 50);
    const [ledStart, setLedStart] = useState(saved?.ledStart ?? "06:00");
    const [ledEnd, setLedEnd] = useState(saved?.ledEnd ?? "10:00");
    const [captureStart, setCaptureStart] = useState(saved?.captureStart ?? "09:00");
    const [captureInterval, setCaptureInterval] = useState(saved?.captureInterval ?? "3시간");
    const [saveMessage, setSaveMessage] = useState("");

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

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await getUserDevicesApi();
                const found = res.data.find(d => d.serialNumber === serialNumber);
                setDevice(found);
                if (found?.plants?.length > 0) {
                    setSelectedPort(found.plants[0].portIndex);
                }
                const noticeRes = await getAllNoticesApi();
                setNotices(noticeRes.data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [serialNumber]);

    const handleSaveSettings = () => {
        localStorage.setItem(storageKey, JSON.stringify({
            autoCapture, isLedOn, rotationAngle, cameraHeight,
            ledStart, ledEnd, captureStart, captureInterval
        }));
        setSaveMessage("✓ 저장되었습니다");
        setTimeout(() => setSaveMessage(""), 2000);
    };

    const handleResetSettings = () => {
        if (!window.confirm("설정을 초기화할까요?")) return;
        localStorage.removeItem(storageKey);
        setAutoCapture(false);
        setIsLedOn(true);
        setRotationAngle(0);
        setCameraHeight(50);
        setLedStart("06:00");
        setLedEnd("10:00");
        setCaptureStart("09:00");
        setCaptureInterval("3시간");
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

    const selectedPlant = device.plants?.find(p => p.portIndex === selectedPort) ?? null;
    const representativePlant = device.plants?.find(p => p.species) ?? null;
    const emoji = representativePlant? (SPECIES_EMOJI[representativePlant.species] || "🌱") : "🌱";

    const temp = device.temperature;
    const humidity = device.humidity;
    const waterLevel = device.waterLevel;
    const ph = device.ph;
    const ec = device.ec;

    const tempOk = temp !== null && temp >= 18 && temp <= 28;
    const humidOk = humidity !== null && humidity >= 50 && humidity <= 80;
    const waterOk = waterLevel !== null && waterLevel >= 50;
    const phOk = ph !== null && ph >= 5.5 && ph <= 7.0;
    const ecOk = ec !== null && ec >= 1.0 && ec <= 2.5;

    const daysSincePlanted = selectedPlant?.plantedAt
        ? Math.floor((new Date() - new Date(selectedPlant.plantedAt)) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
                <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
                <span className="font-semibold text-gray-800 text-sm">{device.deviceNickname} 모니터링</span>
                <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                    실시간 연결
                </span>
            </div>

            <div className="p-5 grid grid-cols-12 gap-4 max-w-screen-xl mx-auto">

                {/* ───── 좌측 사이드바 ───── */}
                <div className="col-span-3 flex flex-col gap-3">

                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">
                                {emoji}
                            </div>
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

                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">🔍</span>
                            <h2 className="text-sm font-semibold text-gray-700">Vision AI 분석</h2>
                        </div>
                        <div className="flex flex-col gap-2 text-xs">
                            {[
                                { label: "생육 상태", value: "✓ 정상", color: "text-green-500" },
                                { label: "병충해", value: "✓ 이상없음", color: "text-green-500" },
                                { label: "성장 속도", value: "+12% 빠름", color: "text-blue-500" },
                                { label: "종합 평가", value: "85점 / 우수", color: "text-green-500" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-gray-400">{label}</span>
                                    <span className={`font-medium ${color}`}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">🔔</span>
                            <h2 className="text-sm font-semibold text-gray-700">최근 알림</h2>
                        </div>
                        <div className="flex flex-col gap-3 text-xs text-gray-500 overflow-y-auto" style={{ height: "550px" }}>
                            {notices.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-300">알림이 없어요</div>
                            ) : (
                                notices.map(notice => (
                                    <div key={notice.id}
                                        className={`border-l-2 pl-2 ${notice.isRead ? "border-gray-200" : "border-green-400"}`}>
                                        <p className="font-medium text-gray-700">{notice.noticeType}</p>
                                        <p className="mt-0.5">{notice.message}</p>
                                        <p className="text-gray-300 mt-0.5">{notice.deviceSerial}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ───── 중앙 콘텐츠 ───── */}
                <div className="col-span-6 flex flex-col gap-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium tracking-widest">TEMPERATURE</span>
                                <span className="text-xl">🌡️</span>
                            </div>
                            <div className={`text-4xl font-bold ${tempOk ? "text-green-500" : "text-yellow-500"}`}>
                                {temp !== null && temp !== undefined ? `${temp}°C` : "-"}
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                                {tempOk ? "✓ 적정 범위" : temp !== null ? "⚠ 범위 벗어남" : "데이터 없음"}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium tracking-widest">HUMIDITY</span>
                                <span className="text-xl">💧</span>
                            </div>
                            <div className={`text-4xl font-bold ${humidOk ? "text-green-500" : "text-yellow-500"}`}>
                                {humidity !== null && humidity !== undefined ? `${humidity}%` : "-"}
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                                {humidOk ? "✓ 정상" : humidity !== null ? "⚠ 확인 필요" : "데이터 없음"}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">📊 양액 시스템 모니터링</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-28 rounded-xl border-2 border-blue-100 bg-blue-50 relative overflow-hidden flex flex-col justify-end">
                                    <div className="bg-blue-400 w-full rounded-b-lg transition-all" style={{ height: `${waterLevel ?? 0}%` }} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-sm font-bold text-blue-700">
                                            {waterLevel !== null && waterLevel !== undefined ? `${waterLevel}%` : "-"}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-400">WATER LEVEL</span>
                                <span className={`text-xs font-medium ${waterOk ? "text-green-500" : "text-yellow-500"}`}>
                                    {waterLevel !== null ? (waterOk ? "충분" : "부족") : "-"}
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-16 h-16 rounded-full border-4 border-green-100 flex items-center justify-center bg-green-50">
                                    <span className="text-lg font-bold text-green-600">{ph ?? "-"}</span>
                                </div>
                                <span className="text-xs text-gray-400">PH LEVEL</span>
                                <span className={`text-xs font-medium ${phOk ? "text-green-500" : "text-yellow-500"}`}>
                                    {ph !== null ? (phOk ? "적정" : "조정 필요") : "-"}
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-16 h-16 rounded-full border-4 border-purple-100 flex items-center justify-center bg-purple-50">
                                    <span className="text-lg font-bold text-purple-600">{ec ?? "-"}</span>
                                </div>
                                <span className="text-xs text-gray-400">TDS (PPM)</span>
                                <span className={`text-xs font-medium ${ecOk ? "text-green-500" : "text-yellow-500"}`}>
                                    {ec !== null ? (ecOk ? "정상" : "확인 필요") : "-"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 생육 변화 그래프 */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
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

                        {/* 포트 선택 버튼 */}
                        <div className="flex gap-1 mb-3 flex-wrap">
                            {PORT_OPTIONS.map(port => {
                                const portPlant = device.plants?.find(p => p.portIndex === port);
                                return (
                                    <button key={port} onClick={() => setSelectedPort(port)}
                                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors border ${
                                            selectedPort === port
                                                ? "bg-green-600 text-white border-green-600"
                                                : portPlant
                                                    ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                                    : "bg-gray-50 text-gray-300 border-gray-100"
                                        }`}
                                    >
                                        {portPlant ? `${port + 1} ${SPECIES_EMOJI[portPlant.species] || "🌱"}` : `${port + 1}`}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="text-xs text-gray-400 mb-2">
                            포트 {selectedPort + 1} · {selectedPlant ? selectedPlant.name : "식물 미등록"}
                        </div>

                        {selectedPlant ? (
                            <>
                                <div className="h-36 flex items-end justify-between gap-1">
                                    {visibleData.map((v, i) => (
                                        <div key={i}
                                            className="flex-1 bg-green-100 rounded-t-sm hover:bg-green-400 transition-colors"
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
                            <div className="h-36 flex items-center justify-center text-gray-300 text-sm">
                                이 포트에 등록된 식물이 없어요
                            </div>
                        )}
                    </div>
                </div>

                {/* ───── 우측 제어판 ───── */}
                <div className="col-span-3 flex flex-col gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">⚙️ 시스템 제어</h2>

                        <div className="mb-4 pb-4 border-b border-gray-50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">💡 LED 조명</span>
                                <div onClick={() => setIsLedOn(prev => !prev)}
                                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isLedOn ? "bg-green-500" : "bg-gray-200"}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${isLedOn ? "left-5" : "left-0.5"}`} />
                                </div>
                            </div>
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
                        </div>

                        <div className="mb-4 pb-4 border-b border-gray-50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">🔄 타워 회전 (스텝모터)</span>
                            </div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-400">회전 각도</span>
                                <span className="text-xs font-bold text-green-600">{rotationAngle}°</span>
                            </div>
                            <input type="range" min="0" max="360" value={rotationAngle}
                                onChange={e => setRotationAngle(Number(e.target.value))}
                                className="w-full accent-green-500" />
                            <button className="w-full mt-2 border border-gray-200 text-xs py-1.5 rounded-lg hover:bg-gray-50 transition-colors">즉시 회전</button>
                        </div>

                        <div className="mb-4 pb-4 border-b border-gray-50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">📷 ESP32-CAM Z축</span>
                            </div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-400">카메라 높이</span>
                                <span className="text-xs font-bold text-green-600">{cameraHeight}cm</span>
                            </div>
                            <input type="range" min="0" max="100" value={cameraHeight}
                                onChange={e => setCameraHeight(Number(e.target.value))}
                                className="w-full accent-green-500" />
                            <button className="w-full mt-2 border border-gray-200 text-xs py-1.5 rounded-lg hover:bg-gray-50 transition-colors">즉시 이동</button>
                        </div>

                        <div className={`mb-4 rounded-xl p-3 transition-colors ${autoCapture ? "bg-green-50 border border-green-100" : "bg-gray-50"}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-xs font-medium ${autoCapture ? "text-green-700" : "text-gray-600"}`}>
                                    💧 자동 촬영 스케줄
                                </span>
                            </div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-gray-700">자동 촬영</span>
                                <div onClick={() => setAutoCapture(prev => !prev)}
                                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${autoCapture ? "bg-green-500" : "bg-gray-200"}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${autoCapture ? "left-5" : "left-0.5"}`} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div>
                                    <label className="text-xs text-gray-400">시작</label>
                                    <input type="time" value={captureStart} onChange={e => setCaptureStart(e.target.value)}
                                        className="w-full border border-gray-100 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 mt-1" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">간격</label>
                                    <select value={captureInterval} onChange={e => setCaptureInterval(e.target.value)}
                                        className="w-full border border-gray-100 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 mt-1">
                                        <option>3시간</option>
                                        <option>6시간</option>
                                        <option>12시간</option>
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                동작 방식: 설정된 시간마다 타워가 360° 회전하면서 카메라가 Z축을 따라 상하로 이동하여 전체 식물을 촬영합니다.
                            </p>
                        </div>

                        {saveMessage && (
                            <div className="text-xs text-green-600 text-center mb-2 font-medium">{saveMessage}</div>
                        )}
                        <button onClick={handleResetSettings}
                            className="w-full border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm py-2.5 rounded-xl transition-colors mb-2">
                            설정 초기화
                        </button>
                        <button onClick={handleSaveSettings}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                            전체 설정 저장
                        </button>
                    </div>

                    <div className="bg-green-50 rounded-2xl border border-green-100 p-4 overflow-y-auto" style={{ height: "200px" }}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">🤖</span>
                            <h2 className="text-sm font-semibold text-green-700">AI 재배 조언</h2>
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-green-800 leading-relaxed">
                            <p><span className="font-semibold">환경 전반:</span> 현재 온도와 습도가 생육에 이상적인 환경입니다.</p>
                            <p><span className="font-semibold">조명 관리:</span> 충분한 광량으로 당도를 높여요.</p>
                            <p><span className="font-semibold">양액 시스템:</span> 현재 설정이 정상 동작 중입니다.</p>
                            <p className="text-green-600">🌟 <span className="font-semibold">성장 속도:</span> 동종 대비 +12% 빠른 성장세를 보이고 있어요.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MonitoringPage;