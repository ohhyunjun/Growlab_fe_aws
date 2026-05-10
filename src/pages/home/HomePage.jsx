import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUnreadCountApi } from "../../api/noticeApi";
import { getUserDevicesApi, deleteDeviceApi } from "../../api/deviceApi";
import { deletePlantApi } from "../../api/plantApi";
import AddDeviceModal from "../../components/device/AddDeviceModal";
import SelectPlantModal from "../../components/device/SelectPlantModal";

const ICONS = ["🍓", "🌿", "🌱", "🌻", "🍅", "🥬", "🌶️", "🌸"];

const STAGE_LABEL = {
    SEED: "씨앗",
    GERMINATION: "발아",
    MATURE: "성숙",
};

const SPECIES_EMOJI = {
    "방울토마토": "🍅",
    "청상추": "🥬",
    "적상추": "🥬",
    "바질": "🌿",
    "딸기": "🍓",
    "파프리카": "🌶️",
    "브로콜리": "🥦",
    "고추": "🌶️",
    "블루베리": "🫐",
    "페퍼민트": "🌿",
    "청경채": "🥬",
    "테이블야자": "🌴",
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

function DeviceCard({ device, onDelete, onPlantRegister, onPlantDelete, onOpenMonitoring }) {
    const savedIconIndex = localStorage.getItem(`device_icon_${device.serialNumber}`);
    const emoji = (savedIconIndex !== null && savedIconIndex !== undefined)
        ? (ICONS[parseInt(savedIconIndex)] || "🌱")
        : "🌱";

    return (
        <div
            onClick={() => onOpenMonitoring(device.serialNumber)}
            className="bg-white rounded-xl border border-gray-200 p-4 relative cursor-pointer hover:shadow-md transition"
        >
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(device.serialNumber); }}
                className="absolute top-3 right-3 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-colors"
            >✕</button>

            <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{emoji}</span>
                <div>
                    <div className="font-semibold text-gray-800 text-sm">{device.deviceNickname}</div>
                    <div className="text-xs text-gray-400">{device.serialNumber}</div>
                    {device.plant ? (
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-600">
                                {SPECIES_EMOJI[device.plant.species] || "🌱"} {device.plant.name}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                                {STAGE_LABEL[device.plant.plantStage] || device.plant.plantStage}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onPlantDelete(device.plant.id); }}
                                className="text-xs text-red-400 hover:text-red-600 ml-1"
                                title="식물 삭제"
                            >🗑</button>
                        </div>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPlantRegister(device.serialNumber); }}
                            className="flex items-center gap-1 mt-0.5 text-xs text-yellow-600 hover:text-yellow-700"
                        >
                            <span>⚠️ 식물 미등록</span>
                            <span className="underline">클릭하여 등록</span>
                        </button>
                    )}
                </div>
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
    const [plantRegisterSerial, setPlantRegisterSerial] = useState(null);
    const [sortKey, setSortKey] = useState("name");
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
        if (sortKey === "name") {
            return copy.sort((a, b) => a.deviceNickname.localeCompare(b.deviceNickname, "ko"));
        } else if (sortKey === "newest") {
            return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sortKey === "oldest") {
            return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return copy;
    };

    const getAverage = (devices, key) => {
        if (!devices || devices.length === 0) return "-";
        const values = devices.map(d => d[key]).filter(v => v !== null && v !== undefined);
        if (values.length === 0) return "-";
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return avg.toFixed(1);
    };

    const handleDelete = async (serialNumber) => {
        if (!window.confirm("기기를 삭제할까요?")) return;
        try {
            await deleteDeviceApi(serialNumber);
            setDevices(prev => prev.filter(d => d.serialNumber !== serialNumber));
        } catch (err) { console.error(err); }
    };

    const handlePlantDelete = async (plantId) => {
        if (!window.confirm("식물을 삭제할까요?")) return;
        try {
            await deletePlantApi(plantId);
            await fetchDevices();
        } catch (err) { console.error(err); }
    };

    const handlePlantRegister = (serialNumber) => {
        setPlantRegisterSerial(serialNumber);
    };

    const avgTemp = getAverage(devices, "temperature");
    const avgHumidity = getAverage(devices, "humidity");

    const summaryItems = [
        { icon: "🌡", label: "평균 온도", value: avgTemp === "-" ? "-" : `${avgTemp}°C`, color: "text-green-600" },
        { icon: "💧", label: "평균 습도", value: avgHumidity === "-" ? "-" : `${avgHumidity}%`, color: "text-green-600" },
        { icon: "⚡", label: "활성 기기", value: `${devices.length}대`, color: "text-green-600", onClick: null },
        { icon: "🔔", label: "미확인 알림", value: `${unreadCount}건`, color: "text-green-600", onClick: () => navigate("/notifications") },
    ];

    const sortedDevices = getSortedDevices();

    return (
        <div className="flex gap-6">
            <div className="w-64 flex-shrink-0 flex flex-col gap-4">
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
                        {/* 정렬 버튼 */}
                        <div className="flex gap-1">
                            {SORT_OPTIONS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSortKey(key)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                        sortKey === key
                                            ? "bg-green-600 text-white"
                                            : "bg-white border border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600"
                                    }`}
                                >
                                    {label}
                                </button>
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
                    <div className={`grid grid-cols-2 gap-4 ${sortedDevices.length > 4 ? "max-h-[900px] overflow-y-auto pr-1" : ""}`}>
                        {sortedDevices.map(device => (
                            <DeviceCard
                                key={device.serialNumber}
                                device={device}
                                onDelete={handleDelete}
                                onPlantRegister={handlePlantRegister}
                                onPlantDelete={handlePlantDelete}
                                onOpenMonitoring={(serial) => navigate(`/monitoring/${serial}`)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showAddModal && (
                <AddDeviceModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={async () => {
                        setShowAddModal(false);
                        await fetchDevices();
                    }}
                />
            )}

            {plantRegisterSerial && (
                <SelectPlantModal
                    serialNumber={plantRegisterSerial}
                    onClose={() => setPlantRegisterSerial(null)}
                    onSuccess={async () => {
                        setPlantRegisterSerial(null);
                        await fetchDevices();
                    }}
                />
            )}
        </div>
    );
}

export default HomePage;