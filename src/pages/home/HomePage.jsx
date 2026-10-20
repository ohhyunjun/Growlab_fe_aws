import { Fragment, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getUserDevicesApi, deleteDeviceApi, updatePortStatusApi } from "../../api/deviceApi";
import { finishPlantApi } from "../../api/plantApi";
import AddDeviceModal from "../../components/device/AddDeviceModal";
import SelectPlantModal from "../../components/device/SelectPlantModal";
import { startMonitoringPerformanceRun } from "../../utils/monitoringPerformance";
import { deviceSensorRanges, sharedSensorStatus } from "../../utils/sharedEnvironment";
import plantIcon from "../../assets/icons/plant.svg";
import dropdownIcon from "../../assets/icons/dropdown.svg";
import addIcon from "../../assets/icons/add.svg";
import temperatureIcon from "../../assets/icons/temperature.svg";
import humidityIcon from "../../assets/icons/humidity.svg";
import deviceIcon from "../../assets/icons/device.svg";
import plusSmallIcon from "../../assets/icons/plus-small.svg";
import { DEVICE_ICONS, DEFAULT_DEVICE_ICON } from "../../assets/deviceIcons";

const SORT_OPTIONS = [
    { key: "name",   label: "이름순" },
    { key: "newest", label: "최신순" },
    { key: "oldest", label: "오래된순" },
];

// ✅ sessionStorage에서 실시간 센서값 읽기
const getSensorData = (serialNumber) => {
    try {
        const saved = sessionStorage.getItem(`growlab_sensor_${serialNumber}`);
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
};

const formatSensor = (value, unit) => {
    if (value === null || value === undefined) return "-";
    return `${value}${unit}`;
};

// 센서 칸 상태별 표시 (Figma: 값 없음 17:86 / 정상·이상 17:2560, Status Color)
const SENSOR_STYLE = {
    none: { box: "border-gray-200 bg-white",          label: "text-gray-400",     value: "text-gray-500" }, // 데이터 없음, LED OFF
    ok:   { box: "border-brand-bright bg-success-bg", label: "text-brand-bright", value: "text-brand" },    // 적정 범위, 수위 정상, LED ON
    bad:  { box: "border-error bg-error-bg",          label: "text-error-sub",    value: "text-error" },    // 범위 벗어남, 수위 부족
};

function DeviceMenu({ device, onDelete }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        ref.current?.querySelector('[role="menuitem"]')?.focus();
        const close = (event) => {
            if (!ref.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, [open]);

    return (
        <div ref={ref} className="relative shrink-0" onClick={event => event.stopPropagation()}
            onKeyDown={event => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    setOpen(false);
                    triggerRef.current?.focus();
                }
            }}>
            <button ref={triggerRef} type="button" aria-label={`${device.deviceNickname} 기기 메뉴`}
                aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}
                className="flex size-9 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
            </button>
            {open && (
                <div role="menu" aria-label="기기 관리" className="absolute right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded bg-gray-200 shadow-sm">
                    <button type="button" role="menuitem" onClick={() => {
                        setOpen(false);
                        triggerRef.current?.focus();
                        onDelete(device.serialNumber);
                    }} className="w-28 whitespace-nowrap px-4 py-2 text-left text-body1 font-medium text-gray-600 hover:bg-gray-400 hover:text-black focus-visible:bg-gray-400 focus-visible:text-black focus-visible:outline-none">
                        기기 삭제
                    </button>
                </div>
            )}
        </div>
    );
}

function DeviceCard({ device, onDelete, onPortClick, onOpenMonitoring }) {
    const savedIconIndex = localStorage.getItem(`device_icon_${device.serialNumber}`);
    const selectedIcon = DEVICE_ICONS[Number.parseInt(savedIconIndex, 10)] || DEFAULT_DEVICE_ICON;

    const portStatus = device.portStatus || "00000000";

    const plants = device.plants || [];
    const speciesNames = [...new Set(plants.map(plant => plant.species || plant.speciesName).filter(Boolean))];

    const [sensor, setSensor] = useState(() => getSensorData(device.serialNumber));

    useEffect(() => {
        const timer = setInterval(() => {
            setSensor(getSensorData(device.serialNumber));
        }, 30000);
        return () => clearInterval(timer);
    }, [device.serialNumber]);

    const temp     = sensor?.temperature        ?? null;
    const humidity = sensor?.humidity           ?? null;
    const ph       = sensor?.ph                 ?? null;
    const tds      = sensor?.tds                ?? null;
    const waterOk  = sensor?.water_level_status ?? null;

    return (
        <div
            onClick={() => onOpenMonitoring(device.serialNumber, null)}
            className="flex min-w-0 cursor-pointer flex-col gap-4 rounded-2xl bg-white p-5 transition-shadow hover:shadow-md lg:p-8"
        >
            {/* 기기 정보 */}
            <div className="flex items-start gap-4">
                <img src={selectedIcon.src} alt="" width="100" height="100" className="size-[100px] shrink-0 object-contain" />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <p className="truncate text-h4 font-bold text-black">{device.deviceNickname}</p>
                    <p className="truncate text-body1 text-gray-400">{device.serialNumber}</p>
                    {plants.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-[10px] rounded border border-brand-bright bg-success-bg px-[7px] py-[3px] text-caption font-medium text-brand">
                                <span className="size-2 rounded-full bg-brand-bright" />
                                가동중 {plants.length}/8
                            </span>
                            {speciesNames.map(name => (
                                <span key={name} title={name} className="max-w-[84px] truncate rounded-full bg-gray-200 px-2 py-1 text-caption text-gray-900">
                                    {name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="py-1 text-caption text-gray-500">빈 포트를 눌러 식물을 추가하세요</p>
                    )}
                </div>
                <DeviceMenu device={device} onDelete={onDelete} />
            </div>

            <div className="flex flex-col gap-5">
                {/* 포트 */}
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(8)].map((_, index) => {
                        const portPlant = plants.find(plant => plant.portIndex === index);
                        const isOccupied = Boolean(portPlant);
                        const isOn = portStatus[index] === "1";
                        const portSpecies = portPlant?.species || portPlant?.speciesName;
                        return (
                            <button
                                type="button"
                                key={index}
                                aria-label={`P${index + 1} ${isOccupied ? portPlant.name || portSpecies : "식물 추가"}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPortClick(device, index, isOccupied);
                                }}
                                className={`flex h-[68px] min-w-0 cursor-pointer select-none flex-col items-center justify-center gap-1 rounded-lg text-body2 font-medium transition-colors ${
                                    isOccupied
                                        ? "bg-brand hover:bg-brand-deep"
                                        : "bg-gray-100 hover:bg-gray-200"
                                }`}
                            >
                                <span className={isOccupied ? "text-brand-cream" : "text-gray-400"}>P{index + 1}</span>
                                {isOccupied ? (
                                    <span className="w-[88px] max-w-full truncate px-1 text-center text-white" title={portSpecies || portPlant.name}>
                                        {portSpecies || portPlant.name}{isOn ? "" : " · OFF"}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-gray-500">
                                        <img src={plusSmallIcon} alt="" width="16" height="16" />
                                        추가
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 센서 수치 (식물이 2개 이상이면 판정 기준 안내를 툴팁으로 표시) */}
                <div
                    className="grid grid-cols-3 gap-4"
                    title={plants.length > 1 ? "센서값은 기기 공통이며, 표시 색은 심은 모든 품종의 적정 범위를 기준으로 합니다." : undefined}
                >
                    {(() => {
                        const ranges = deviceSensorRanges(plants);
                        const allInRange = (value, key) => sharedSensorStatus(value, ranges[key]);
                        const tempOk  = allInRange(temp, "temp");
                        const humidOk = allInRange(humidity, "humidity");
                        const phOk    = allInRange(ph, "ph");
                        const tdsOk   = allInRange(tds, "tds");

                        const getState = (hasData, isOk) => !hasData || !plants.length || isOk === null ? "none" : isOk ? "ok" : "bad";

                        return [
                            { label: "온도", value: formatSensor(temp, " °C"),                    state: getState(temp     !== null, tempOk)  },
                            { label: "습도", value: formatSensor(humidity, "%"),                   state: getState(humidity !== null, humidOk) },
                            { label: "PH",   value: formatSensor(ph, ""),                         state: getState(ph       !== null, phOk)    },
                            { label: "TDS",  value: tds !== null ? `${Math.round(tds)} ppm` : "-", state: getState(tds      !== null, tdsOk)   },
                            { label: "수위", value: waterOk === null ? "-" : waterOk ? "정상" : "부족", state: waterOk === null ? "none" : waterOk ? "ok" : "bad" },
                            { label: "LED",  value: device.ledStatus ? "ON" : "OFF",              state: device.ledStatus ? "ok" : "none" },
                        ];
                    })().map(({ label, value, state }) => (
                        <div key={label} className={`flex h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border font-medium ${SENSOR_STYLE[state].box}`}>
                            <span className={`text-body1 ${SENSOR_STYLE[state].label}`}>{label}</span>
                            <span className={`max-w-full truncate text-h4 ${SENSOR_STYLE[state].value}`}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// 정렬 드롭다운 (Figma): 버튼엔 현재 기준, 메뉴엔 나머지 기준
function SortDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const triggerRef = useRef(null);
    const current = SORT_OPTIONS.find(option => option.key === value);

    useEffect(() => {
        if (!open) return;
        ref.current?.querySelector('[role="option"]')?.focus();
        const close = (e) => {
            if (!ref.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, [open]);

    return (
        <div ref={ref} className="relative" onKeyDown={event => {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
            if (event.key === "Tab") setOpen(false);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                if (!open) { setOpen(true); return; }
                const options = [...ref.current.querySelectorAll('[role="option"]')];
                const index = options.indexOf(document.activeElement);
                const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
                    : (index + (event.key === "ArrowUp" ? -1 : 1) + options.length) % options.length;
                options[next]?.focus();
            }
        }}>
            <button
                ref={triggerRef}
                type="button"
                aria-label={`기기 정렬: ${current.label}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 rounded bg-white px-4 py-2"
            >
                <span className="min-w-[52px] whitespace-nowrap text-left text-body1 font-medium text-gray-700">{current.label}</span>
                <img src={dropdownIcon} alt="" width="24" height="24" />
            </button>
            {open && (
                <ul role="listbox" aria-label="기기 정렬 기준" className="absolute left-0 top-[calc(100%+6px)] z-20 flex min-w-full flex-col overflow-hidden rounded">
                    {SORT_OPTIONS.filter(option => option.key !== value).map(({ key, label }) => (
                        <li key={key} role="none">
                            <button
                                type="button"
                                role="option"
                                aria-selected="false"
                                onClick={() => { onChange(key); setOpen(false); triggerRef.current?.focus(); }}
                                className="w-full min-w-28 whitespace-nowrap bg-gray-200 px-4 py-2 text-left text-body1 font-medium text-gray-600 hover:bg-gray-400 hover:text-black focus-visible:bg-gray-400 focus-visible:text-black focus-visible:outline-none"
                            >
                                {label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function HomePage() {
    const [devices, setDevices]       = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortKey, setSortKey]       = useState("name");
    const [selectingPlant, setSelectingPlant] = useState(null);
    const [endingPlant, setEndingPlant] = useState(null);
    const [endingLoading, setEndingLoading] = useState(false);

    const navigate = useNavigate();

    const fetchDevices = async () => {
        try {
            const res = await getUserDevicesApi();
            setDevices(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        getUserDevicesApi()
            .then(res => setDevices(res.data))
            .catch(err => console.error(err));
    }, []);

    const getSortedDevices = () => {
        const copy = [...devices];
        if (sortKey === "name")   return copy.sort((a, b) => a.deviceNickname.localeCompare(b.deviceNickname, "ko"));
        if (sortKey === "newest") return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (sortKey === "oldest") return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return copy;
    };

    const getAverage = (deviceList, key) => {
        if (!deviceList || deviceList.length === 0) return "-";
        const values = deviceList
            .map(d => getSensorData(d.serialNumber)?.[key])
            .filter(v => v !== null && v !== undefined);
        if (values.length === 0) return "-";
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    };

    const handleDelete = async (serialNumber) => {
        const device = devices.find(d => d.serialNumber === serialNumber);
        if (device?.plants?.length > 0) {
            alert("기기에 등록된 식물이 있어요.\n각 포트를 OFF하여 식물을 먼저 해제한 후 삭제해주세요.");
            return;
        }
        if (!window.confirm("기기를 삭제할까요?")) return;
        try {
            await deleteDeviceApi(serialNumber);
            // ✅ device_species는 이제 localStorage에 없지만, 아이콘/설정은 여전히 로컬 보관
            localStorage.removeItem(`device_icon_${serialNumber}`);
            localStorage.removeItem(`device_settings_${serialNumber}`);
            setDevices(prev => prev.filter(d => d.serialNumber !== serialNumber));
        } catch (err) {
            console.error(err);
            alert("기기 삭제에 실패했습니다.");
        }
    };

    const handlePortClick = async (device, portIndex, isOccupied) => {
        if (isOccupied) {
            const portPlant = device.plants?.find(p => p.portIndex === portIndex);
            if (portPlant) {
                setEndingPlant({ plant: portPlant, portIndex });
                return;
            }
            try {
                await updatePortStatusApi(device.serialNumber, portIndex, false);
                await fetchDevices();
            } catch (err) {
                console.error(err);
                alert("포트 제어에 실패했습니다.");
            }
        } else {
            setSelectingPlant({ serialNumber: device.serialNumber, portIndex });
        }
    };

    const handleFinishPlant = async (reason) => {
        if (!endingPlant || endingLoading) return;
        setEndingLoading(true);
        try {
            await finishPlantApi(endingPlant.plant.id, reason);
            setEndingPlant(null);
            await fetchDevices();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || err.response?.data || "재배 종료에 실패했습니다.");
        } finally {
            setEndingLoading(false);
        }
    };

    const handleOpenMonitoring = (serial, portIndex) => {
        const perfRunId = startMonitoringPerformanceRun(serial);
        navigate(`/monitoring/${serial}`, {
            state: {
                ...(portIndex !== null && portIndex !== undefined ? { portIndex } : {}),
                perfRunId,
            }
        });
    };

    const handleAddDevice = () => {
        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }
        setShowAddModal(true);
    };

    const avgTemp     = getAverage(devices, "temperature");
    const avgHumidity = getAverage(devices, "humidity");

    // 미확인 알림은 상단 바의 알림 버튼으로 이동
    const summaryItems = [
        { icon: temperatureIcon, label: "평균 온도", value: avgTemp     === "-" ? "-" : `${avgTemp}°C`,    gap: "gap-1" },
        { icon: humidityIcon,    label: "평균 습도", value: avgHumidity === "-" ? "-" : `${avgHumidity}%`, gap: "gap-1" },
        { icon: deviceIcon,      label: "활성 기기", value: `${devices.length}대`,                         gap: "gap-2" },
    ];

    const sortedDevices = getSortedDevices();

    return (
        // PC: 상단 바(88) + 간격(24)을 뺀 화면 높이에 맞추고 카드 목록만 내부 스크롤 (Figma)
        <div className="@container flex flex-col gap-6 lg:h-[calc(var(--screen-h)-112px)]">
            {/* 섹션 헤더 */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                    <img src={plantIcon} alt="" width="48" height="48" />
                    <h2 className="text-h2 font-bold text-gray-800">나의 농장</h2>
                </div>
                <div className="flex items-center gap-6">
                    <SortDropdown value={sortKey} onChange={setSortKey} />
                    <button
                        type="button"
                        onClick={handleAddDevice}
                        className="flex items-center gap-2 rounded bg-brand px-5 py-2 transition-colors hover:bg-brand-deep"
                    >
                        <img src={addIcon} alt="" width="24" height="24" />
                        <span className="w-[72px] text-center text-body1 font-medium text-white">기기 추가</span>
                    </button>
                </div>
            </div>

            {/* Figma 1:1687: 환경 요약 높이 76px, 모서리와 안쪽 여백 12px. */}
            {sortedDevices.length > 0 && (
            <div className="flex shrink-0 flex-col gap-3 rounded-xl bg-white p-3 @[1080px]:h-[76px] @[1080px]:flex-row @[1080px]:items-stretch">
                <p className="flex shrink-0 items-center px-5 text-sub1 font-bold text-gray-700 @[1080px]:w-[192px]">전체 환경 요약</p>
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded bg-gray-100 px-5 py-3 @[1080px]:min-w-0 @[1080px]:flex-1 @[1080px]:flex-nowrap @[1080px]:gap-x-4 @[1080px]:py-0">
                    {summaryItems.map(({ icon, label, value }, index) => (
                        <Fragment key={label}>
                            {index > 0 && <span aria-hidden="true" className="hidden h-6 w-0.5 shrink-0 bg-gray-300 @[1080px]:block" />}
                            <div className="flex shrink-0 items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <img src={icon} alt="" width="24" height="24" />
                                    <span className="whitespace-nowrap text-body1 font-medium text-gray-500">{label}</span>
                                </div>
                                <span className="whitespace-nowrap text-sub1 font-bold text-brand">{value}</span>
                            </div>
                        </Fragment>
                    ))}
                </div>
            </div>
            )}

            {sortedDevices.length === 0 ? (
                // 빈 상태 (Figma 17:2491, 로그아웃·기기 0대 공통): 남은 높이를 채우는 gray-200 박스, 아래 여백 24
                <div className="flex min-h-60 items-center justify-center rounded-2xl bg-gray-200 lg:mb-6 lg:flex-1">
                    <p className="text-sub1 font-medium text-gray-500">등록된 기기가 없어요</p>
                </div>
            ) : (
                // 기기 카드 목록: 이 영역만 내부 스크롤
                <div className="@container lg:min-h-0 lg:flex-1 lg:overflow-y-scroll lg:scrollbar-growlab">
                    <div className="grid grid-cols-1 gap-6 pb-6 @[1000px]:grid-cols-2">
                        {sortedDevices.map(device => (
                            <DeviceCard
                                key={device.serialNumber}
                                device={device}
                                onDelete={handleDelete}
                                onPortClick={handlePortClick}
                                onOpenMonitoring={handleOpenMonitoring}
                            />
                        ))}
                    </div>
                </div>
            )}

            {showAddModal && (
                <AddDeviceModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchDevices}
                />
            )}

            {selectingPlant && (
                <SelectPlantModal
                    serialNumber={selectingPlant.serialNumber}
                    portIndex={selectingPlant.portIndex}
                    existingPlants={devices.find(device => device.serialNumber === selectingPlant.serialNumber)?.plants || []}
                    onClose={() => setSelectingPlant(null)}
                    onSuccess={fetchDevices}
                />
            )}

            {endingPlant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                        <h2 className="text-body1 font-bold text-gray-800">P{endingPlant.portIndex + 1} 재배 종료</h2>
                        <p className="mt-2 text-body2 text-gray-600">{endingPlant.plant.name} 재배를 어떻게 마쳤나요? 기록과 일지는 보존됩니다.</p>
                        <div className="mt-5 flex flex-col gap-2">
                            <button disabled={endingLoading} onClick={() => handleFinishPlant("HARVESTED")}
                                className="rounded-lg bg-brand px-4 py-3 text-body2 font-medium text-white hover:bg-brand-deep disabled:opacity-50">수확했어요</button>
                            <button disabled={endingLoading} onClick={() => handleFinishPlant("DIED")}
                                className="rounded-lg border border-gray-200 px-4 py-3 text-body2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">병들거나 시들어 죽었어요</button>
                            <button disabled={endingLoading} onClick={() => setEndingPlant(null)}
                                className="px-4 py-2 text-body2 text-gray-500 disabled:opacity-50">취소</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HomePage;
