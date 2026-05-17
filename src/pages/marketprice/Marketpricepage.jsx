import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "http://localhost:8080/api/prices";
const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// GrowLab에서 재배하는 품목 목록
const ITEMS = [
    { name: "방울토마토", emoji: "🍅" },
    { name: "청상추",    emoji: "🥬" },
    { name: "적상추",    emoji: "🥬" },
    { name: "바질",     emoji: "🌿" },
    { name: "딸기",     emoji: "🍓" },
    { name: "파프리카", emoji: "🌶️" },
    { name: "브로콜리", emoji: "🥦" },
    { name: "고추",     emoji: "🌶️" },
    { name: "블루베리", emoji: "🫐" },
    { name: "페퍼민트", emoji: "🌿" },
    { name: "청경채",   emoji: "🥬" },
];

// 가격 변동 방향 계산
function getPriceTrend(weekly) {
    if (!weekly || weekly.length < 2) return null;
    const last = weekly[weekly.length - 1];
    const prev = weekly[weekly.length - 2];
    const diff = (last.retailPrice ?? last.wholesalePrice) - (prev.retailPrice ?? prev.wholesalePrice);
    if (diff > 0) return { dir: "up",   label: `+${diff.toLocaleString()}원`, color: "text-red-500" };
    if (diff < 0) return { dir: "down", label: `${diff.toLocaleString()}원`,  color: "text-blue-500" };
    return { dir: "flat", label: "변동없음", color: "text-gray-400" };
}

// 미니 바 차트
function MiniBarChart({ data, valueKey }) {
    if (!data || data.length === 0) return null;
    const values = data.map(d => d[valueKey] ?? 0);
    const max = Math.max(...values, 1);

    return (
        <div className="flex items-end gap-1 h-12">
            {values.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                        className={`w-full rounded-t-sm transition-all ${
                            i === values.length - 1 ? "bg-green-500" : "bg-green-100"
                        }`}
                        style={{ height: `${Math.max((v / max) * 44, 2)}px` }}
                    />
                </div>
            ))}
        </div>
    );
}

// 품목 카드 컴포넌트
function PriceCard({ item, onClick, isSelected }) {
    const [latest, setLatest] = useState(null);
    const [weekly, setWeekly] = useState([]);
    const [status, setStatus] = useState("idle"); // idle | loading | ok | error

    useEffect(() => {
        setStatus("loading");
        Promise.all([
            axios.get(`${API_BASE}/latest?itemName=${encodeURIComponent(item.name)}`, authHeader()),
            axios.get(`${API_BASE}/weekly?itemName=${encodeURIComponent(item.name)}`, authHeader()),
        ])
            .then(([latestRes, weeklyRes]) => {
                setLatest(latestRes.data);
                setWeekly(weeklyRes.data);
                setStatus("ok");
            })
            .catch(() => setStatus("error"));
    }, [item.name]);

    const trend = getPriceTrend(weekly);

    return (
        <div
            onClick={() => onClick(item, latest, weekly)}
            className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "border-green-400 ring-2 ring-green-100" : "border-gray-100"
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                </div>
                {trend && (
                    <span className={`text-xs font-medium ${trend.color}`}>
                        {trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "—"} {trend.label}
                    </span>
                )}
            </div>

            {status === "loading" && (
                <div className="h-16 flex items-center justify-center text-gray-300 text-xs">불러오는 중...</div>
            )}
            {status === "error" && (
                <div className="h-16 flex items-center justify-center text-gray-300 text-xs">데이터 없음</div>
            )}
            {status === "ok" && latest && (
                <>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                        <div className="bg-blue-50 rounded-xl p-2 text-center">
                            <p className="text-gray-400 mb-0.5">도매</p>
                            <p className="font-bold text-blue-600">
                                {latest.wholesalePrice != null
                                    ? `${latest.wholesalePrice.toLocaleString()}원`
                                    : "-"}
                            </p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-2 text-center">
                            <p className="text-gray-400 mb-0.5">소매</p>
                            <p className="font-bold text-green-600">
                                {latest.retailPrice != null
                                    ? `${latest.retailPrice.toLocaleString()}원`
                                    : "-"}
                            </p>
                        </div>
                    </div>
                    <MiniBarChart data={weekly} valueKey="retailPrice" />
                    <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                        <span>6일 전</span>
                        <span>오늘</span>
                    </div>
                    <p className="text-[10px] text-gray-300 mt-1.5 text-right">
                        단위: {latest.priceUnit ?? "-"} · 기준 {latest.priceDate}
                    </p>
                </>
            )}
        </div>
    );
}

// 상세 패널 컴포넌트
function DetailPanel({ item, latest, weekly, onClose }) {
    if (!item) return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
            <span className="text-4xl mb-3">📊</span>
            <p className="text-sm text-gray-400">품목을 선택하면<br />상세 가격 정보를 볼 수 있어요</p>
        </div>
    );

    const trend = getPriceTrend(weekly);
    const max = Math.max(...(weekly.map(d => Math.max(d.wholesalePrice ?? 0, d.retailPrice ?? 0))), 1);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                        <h2 className="text-base font-bold text-gray-800">{item.name}</h2>
                        {latest && (
                            <p className="text-xs text-gray-400">
                                기준일: {latest.priceDate} · 단위: {latest.priceUnit ?? "-"}
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg leading-none">✕</button>
            </div>

            {/* 최신 가격 */}
            {latest && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-2xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">도매가</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {latest.wholesalePrice != null ? `${latest.wholesalePrice.toLocaleString()}` : "-"}
                        </p>
                        <p className="text-xs text-blue-400">원</p>
                    </div>
                    <div className="bg-green-50 rounded-2xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">소매가</p>
                        <p className="text-2xl font-bold text-green-600">
                            {latest.retailPrice != null ? `${latest.retailPrice.toLocaleString()}` : "-"}
                        </p>
                        <p className="text-xs text-green-400">원</p>
                    </div>
                </div>
            )}

            {/* 전일 대비 */}
            {trend && (
                <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between text-sm ${
                    trend.dir === "up"   ? "bg-red-50 text-red-500" :
                    trend.dir === "down" ? "bg-blue-50 text-blue-500" :
                    "bg-gray-50 text-gray-400"
                }`}>
                    <span className="font-medium">전일 대비 소매가</span>
                    <span className="font-bold">
                        {trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "—"} {trend.label}
                    </span>
                </div>
            )}

            {/* 주간 차트 */}
            {weekly.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 mb-3">📈 최근 7일 가격 추이</h3>
                    <div className="flex items-end gap-2 h-28">
                        {weekly.map((d, i) => {
                            const wh = d.wholesalePrice ?? 0;
                            const re = d.retailPrice ?? 0;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                                    {/* tooltip */}
                                    <div className="hidden group-hover:flex flex-col items-center absolute -translate-y-12 bg-gray-800 text-white text-[10px] rounded-lg px-2 py-1 z-10 whitespace-nowrap">
                                        <span>도: {wh.toLocaleString()}원</span>
                                        <span>소: {re.toLocaleString()}원</span>
                                    </div>
                                    <div className="w-full flex gap-0.5 items-end relative">
                                        <div
                                            className="flex-1 bg-blue-200 rounded-t-sm hover:bg-blue-400 transition-colors"
                                            style={{ height: `${Math.max((wh / max) * 96, 2)}px` }}
                                            title={`도매: ${wh.toLocaleString()}원`}
                                        />
                                        <div
                                            className="flex-1 bg-green-300 rounded-t-sm hover:bg-green-500 transition-colors"
                                            style={{ height: `${Math.max((re / max) * 96, 2)}px` }}
                                            title={`소매: ${re.toLocaleString()}원`}
                                        />
                                    </div>
                                    <span className="text-[9px] text-gray-300 mt-1">
                                        {d.priceDate?.slice(5)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {/* 범례 */}
                    <div className="flex gap-3 mt-2 justify-end">
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block" />도매
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-sm bg-green-300 inline-block" />소매
                        </span>
                    </div>
                </div>
            )}

            {weekly.length === 0 && (
                <div className="flex items-center justify-center py-6 text-gray-300 text-sm">
                    주간 데이터가 없어요
                </div>
            )}
        </div>
    );
}

// 메인 페이지
function MarketPricePage() {
    const navigate = useNavigate();
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedLatest, setSelectedLatest] = useState(null);
    const [selectedWeekly, setSelectedWeekly] = useState([]);

    const handleCardClick = (item, latest, weekly) => {
        if (selectedItem?.name === item.name) {
            setSelectedItem(null);
            setSelectedLatest(null);
            setSelectedWeekly([]);
        } else {
            setSelectedItem(item);
            setSelectedLatest(latest);
            setSelectedWeekly(weekly ?? []);
        }
    };

    return (
        <div className="max-w-screen-xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 text-sm">← 홈</button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800">🏪 농산물 도소매 가격</h1>
                        <p className="text-xs text-gray-400 mt-0.5">매일 오전 6시 자동 업데이트 · KAMIS 공공데이터 기준</p>
                    </div>
                </div>
            </div>

            {/* 본문 — 카드 그리드 + 상세 패널 */}
            <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                {/* 품목 카드 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-grow">
                    {ITEMS.map(item => (
                        <PriceCard
                            key={item.name}
                            item={item}
                            onClick={handleCardClick}
                            isSelected={selectedItem?.name === item.name}
                        />
                    ))}
                </div>

                {/* 상세 패널 — lg 이상에서 우측 고정 */}
                <div className="w-full lg:w-72 lg:flex-shrink-0">
                    <DetailPanel
                        item={selectedItem}
                        latest={selectedLatest}
                        weekly={selectedWeekly}
                        onClose={() => {
                            setSelectedItem(null);
                            setSelectedLatest(null);
                            setSelectedWeekly([]);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default MarketPricePage;