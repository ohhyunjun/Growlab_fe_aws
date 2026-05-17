import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUnreadCountApi } from "../../api/noticeApi";
import { getUserDevicesApi, deleteDeviceApi, updatePortStatusApi } from "../../api/deviceApi";
import { createPlantApi, deletePlantApi } from "../../api/plantApi";
import AddDeviceModal from "../../components/device/AddDeviceModal";
import SelectPlantModal from "../../components/device/SelectPlantModal";

const ICONS = ["🍓", "🌿", "🌱", "🌻", "🍅", "🥬", "🌶️", "🌸"];

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const formatValue = (value, unit) => {
    if (value === null || value === undefined) return "-";
    return `${value}${unit}`;
};

const SORT_OPTIONS = [
    { key: "name", label: "이름순" },
    { key: "newest", label: "최신순" },
    { key: "oldest", label: "오래된순" },
];

// ✅ localStorage에서 기기 대표 품종 가져오기
const getDeviceSpecies = (serialNumber) => {
    try {
        const saved = localStorage.getItem(`device_species_${serialNumber}`);
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
};

// ✅ localStorage에 기기 대표 품종 저장
const setDeviceSpecies = (serialNumber, speciesData) => {
    localStorage.setItem(`device_species_${serialNumber}`, JSON.stringify(speciesData));
};

function DeviceCard({ device, onDelete, onPortClick, onSelectSpecies, onOpenMonitoring }) {
    const savedIconIndex = localStorage.getItem(`device_icon_${device.serialNumber}`);
    const emoji = (savedIconIndex !== null && savedIconIndex !== undefined)
        ? (ICONS[parseInt(savedIconIndex)] || "🌱")
        : "🌱";

    const portStatus = device.portStatus || "00000000";

    // ✅ 이 기기의 대표 품종 (localStorage)
    const deviceSpecies = getDeviceSpecies(device.serialNumber);
    const speciesName = deviceSpecies?.speciesName || null;
    const speciesEmoji = speciesName ? (SPECIES_EMOJI[speciesName] || "🌱") : null;

    return (
        <div
            onClick={() => onOpenMonitoring(device.serialNumber, null)}
            className="bg-white rounded-xl border border-gray-200 p-4 relative cursor-pointer hover:shadow-md transition"
        >
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(device.serialNumber); }}
                className="absolute top-3 right-3 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-colors z-10"
            >✕</button>

            <div className="flex items-center gap-3 mb-4">
                {/* ✅ 기기 아이콘은 항상 고정 (품종 변경해도 유지) */}
                <span className="text-3xl">{emoji}</span>
                <div>
                    <div className="font-semibold text-gray-800 text-sm">{device.deviceNickname}</div>
                    <div className="text-xs text-gray-400">{device.serialNumber}</div>

                    {speciesName ? (
                        // ✅ 품종 등록됨 → "청상추" 만 표시 (P1 없이)
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-600 font-medium">
                                {speciesEmoji} {speciesName}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectSpecies(device.serialNumber);
                                }}
                                className="text-[10px] text-blue-400 hover:text-blue-600 ml-1 underline"
                            >변경</button>
                        </div>
                    ) : (
                        // ✅ 품종 미등록 → 품종 선택 유도
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectSpecies(device.serialNumber);
                            }}
                            className="flex items-center gap-1 mt-0.5 text-[11px] text-yellow-600 animate-pulse"
                        >
                            <span>⚠️ 식물 미등록</span>
                            <span className="underline">클릭하여 품종 선택</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 포트 박스 그리드 */}
            <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 mb-4">
                {[...Array(8)].map((_, index) => {
                    const isOn = portStatus[index] === "1";

                    return (
                        <div
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!speciesName) {
                                    alert("먼저 품종을 선택해주세요.");
                                    return;
                                }
                                onPortClick(device, index, isOn);
                            }}
                            className={`flex flex-col items-center justify-center h-14 rounded-md transition-all border cursor-pointer select-none ${
                                isOn
                                    ? "bg-green-50 border-green-300 shadow-sm hover:bg-green-100"
                                    : "bg-gray-100 border-gray-200 opacity-60 hover:opacity-100 hover:border-green-200"
                            }`}
                        >
                            <span className={`text-[8px] font-bold ${isOn ? "text-green-600" : "text-gray-400"}`}>
                                P{index + 1}
                            </span>
                            {isOn ? (
                                speciesEmoji
                                    ? <span className="text-lg">{speciesEmoji}</span>
                                    : <span className="text-xs font-medium text-green-600">ON</span>
                            ) : (
                                <span className="text-xs font-medium text-gray-400">OFF</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                {[
                    { label: "온도", value: formatValue(device.temperature, "°C") },
                    { label: "습도", value: formatValue(device.humidity, "%") },
                    { label: "pH", value: formatValue(device.ph, "") },
                    { label: "EC", value: formatValue(device.ec, "") },
                    { label: "수위", value: formatValue(device.waterLevel, "") },
                    { label: "조명", value: device.status ? "ON" : "OFF" },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg py-2">
                        <div className="text-xs text-gray-400">{label}</div>
                        <div className="text-sm font-semibold text-gray-700">{value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HomePage() {
    const [devices, setDevices] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortKey, setSortKey] = useState("name");

    // ✅ 품종 선택 모달용 상태 (portIndex 없이 serialNumber만)
    const [selectingSpeciesSerial, setSelectingSpeciesSerial] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetchDevices();
        getUnreadCountApi()
            .then(res => setUnreadCount(res.data))
            .catch(err => console.error(err));
    }, []);

    const fetchDevices = async () => {
        try {
            const res = await getUserDevicesApi();
            setDevices(res.data);
        } catch (err) { console.error(err); }
    };

    const getSortedDevices = () => {
        const copy = [...devices];
        if (sortKey === "name") return copy.sort((a, b) => a.deviceNickname.localeCompare(b.deviceNickname, "ko"));
        if (sortKey === "newest") return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (sortKey === "oldest") return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return copy;
    };

    const getAverage = (devices, key) => {
        if (!devices || devices.length === 0) return "-";
        const values = devices.map(d => d[key]).filter(v => v !== null && v !== undefined);
        if (values.length === 0) return "-";
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    };

    const handleDelete = async (serialNumber) => {
        if (!window.confirm("기기를 삭제할까요?")) return;
        try {
            await deleteDeviceApi(serialNumber);
            setDevices(prev => prev.filter(d => d.serialNumber !== serialNumber));
        } catch (err) { console.error(err); }
    };

    // ✅ 포트 ON → 대표 품종으로 해당 포트에 식물 자동 등록 + 포트 ON
    // ✅ 포트 OFF → 해당 포트 식물 삭제 + 포트 OFF
    const handlePortClick = async (device, portIndex, isCurrentlyOn) => {
        const deviceSpecies = getDeviceSpecies(device.serialNumber);

        if (isCurrentlyOn) {
            // ON → OFF
            const portPlant = device.plants?.find(p => p.portIndex === portIndex);
            if (portPlant) {
                if (!window.confirm(`P${portIndex + 1} 포트를 OFF하면 식물이 삭제됩니다. 계속할까요?`)) return;
                try {
                    await deletePlantApi(portPlant.id);
                } catch (err) {
                    alert("식물 삭제에 실패했습니다.");
                    return;
                }
            }
            try {
                await updatePortStatusApi(device.serialNumber, portIndex, false);
                await fetchDevices();
            } catch (err) {
                alert("포트 제어에 실패했습니다.");
            }
        } else {
            // OFF → ON: 대표 품종으로 해당 포트에 식물 자동 등록
            if (!deviceSpecies) {
                alert("먼저 품종을 선택해주세요.");
                return;
            }
            try {
                // ✅ 포트에 식물 자동 등록 (품종명을 이름으로, speciesId 사용)
                await createPlantApi({
                    name: deviceSpecies.speciesName,
                    speciesId: deviceSpecies.speciesId,
                    serialNumber: device.serialNumber,
                    portIndex: portIndex,
                    plantStage: "SEED",
                    plantedAt: new Date().toISOString(),
                });
                await updatePortStatusApi(device.serialNumber, portIndex, true);
                await fetchDevices();
            } catch (err) {
                console.error("식물 등록 실패:", err);
                alert("식물 등록에 실패했습니다. 이미 등록된 포트일 수 있어요.");
            }
        }
    };

    // ✅ 품종 선택 모달에서 완료 시 → localStorage 저장만, 포트 ON/OFF는 건드리지 않음
    const handleSpeciesSelected = (serialNumber, speciesId, speciesName) => {
        setDeviceSpecies(serialNumber, { speciesId, speciesName });
        setSelectingSpeciesSerial(null);
        // 화면 리렌더링을 위해 devices 재조회
        fetchDevices();
    };

    const handleOpenMonitoring = (serial, portIndex) => {
        navigate(`/monitoring/${serial}`, {
            state: portIndex !== null && portIndex !== undefined ? { portIndex } : {}
        });
    };

    const avgTemp = getAverage(devices, "temperature");
    const avgHumidity = getAverage(devices, "humidity");

    const summaryItems = [
        { icon: "🌡", label: "평균 온도", value: avgTemp === "-" ? "-" : `${avgTemp}°C`, color: "text-green-600" },
        { icon: "💧", label: "평균 습도", value: avgHumidity === "-" ? "-" : `${avgHumidity}%`, color: "text-green-600" },
        { icon: "⚡", label: "활성 기기", value: `${devices.length}대`, color: "text-green-600" },
        { icon: "🔔", label: "미확인 알림", value: `${unreadCount}건`, color: "text-green-600", onClick: () => navigate("/notifications") },
    ];

    const sortedDevices = getSortedDevices();

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-64 lg:flex-shrink-0 flex flex-col gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">바로가기</div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => navigate("/diary")}
                            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                            <span className="text-xl">📔</span>
                            <span className="text-xs text-gray-600">다이어리</span>
                        </button>
                        <button onClick={() => navigate("/mypage")}
                            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                            <span className="text-xl">🤍</span>
                            <span className="text-xs text-gray-600">마이페이지</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">전체 환경 요약</div>
                    <div className="flex flex-col gap-2 text-sm">
                        {summaryItems.map(({ icon, label, value, color, onClick }) => (
                            <div key={label} onClick={onClick}
                                className={`flex justify-between items-center py-1 border-b border-gray-50 last:border-0 ${onClick ? "cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors" : ""}`}>
                                <span className="text-gray-500">{icon} {label}</span>
                                <span className={`font-semibold ${color}`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-gray-800">My Farm</h2>
                        <div className="flex gap-1">
                            {SORT_OPTIONS.map(({ key, label }) => (
                                <button key={key} onClick={() => setSortKey(key)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                        sortKey === key
                                            ? "bg-green-600 text-white"
                                            : "bg-white border border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600"
                                    }`}>{label}</button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const token = localStorage.getItem("token");
                            if (!token) { navigate("/login"); return; }
                            setShowAddModal(true);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                        + 기기 추가
                    </button>
                </div>

                {sortedDevices.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                        <div className="text-4xl mb-3">🌱</div>
                        <p className="text-gray-400 text-sm">등록된 기기가 없어요</p>
                        <button
                            onClick={() => {
                                const token = localStorage.getItem("token");
                                if (!token) { navigate("/login"); return; }
                                setShowAddModal(true);
                            }}
                            className="mt-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                            + 기기 추가하기
                        </button>
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 ${sortedDevices.length > 4 ? "max-h-[900px] overflow-y-auto pr-1" : ""}`}>
                        {sortedDevices.map(device => (
                            <DeviceCard
                                key={device.serialNumber}
                                device={device}
                                onDelete={handleDelete}
                                onPortClick={handlePortClick}
                                onSelectSpecies={(serial) => setSelectingSpeciesSerial(serial)}
                                onOpenMonitoring={handleOpenMonitoring}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showAddModal && (
                <AddDeviceModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchDevices}
                />
            )}

            {/* ✅ 품종 선택 모달 — portIndex 없이 기기 단위로만 */}
            {selectingSpeciesSerial && (
                <SelectPlantModal
                    serialNumber={selectingSpeciesSerial}
                    portIndex={null}
                    onClose={() => setSelectingSpeciesSerial(null)}
                    onSuccess={(speciesId, speciesName) =>
                        handleSpeciesSelected(selectingSpeciesSerial, speciesId, speciesName)
                    }
                />
            )}
        </div>
    );
}

export default HomePage;