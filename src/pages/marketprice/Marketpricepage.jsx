import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLatestPrice, getWeeklyPrice } from "../../api/marketpriceApi";

/**
 * ITEMS: itemCode/kindCode는 KAMIS 품목코드 기준
 */
const ITEMS = [
    { name: "방울토마토", emoji: "🍅", itemCode: "422", kindCode: "01" },
    { name: "청상추",    emoji: "🥬", itemCode: "214", kindCode: "02" },
    { name: "적상추",    emoji: "🥬", itemCode: "214", kindCode: "01" },
    { name: "딸기",     emoji: "🍓", itemCode: "226", kindCode: "00" },
    { name: "파프리카", emoji: "🌶️", itemCode: "256", kindCode: "00" },
    { name: "풋고추",   emoji: "🌶️", itemCode: "242", kindCode: "04" },
    { name: "시금치",   emoji: "🥬", itemCode: "213", kindCode: "00" },
    { name: "토마토",   emoji: "🍅", itemCode: "225", kindCode: "00" },
    { name: "오이",     emoji: "🥒", itemCode: "223", kindCode: "01" },
    { name: "피망",     emoji: "🫑", itemCode: "255", kindCode: "00" },
    { name: "깻잎",     emoji: "🍃", itemCode: "253", kindCode: "00" },
];

/**
 * 날짜별 평균 계산 후 최근 7일만 반환
 */
function aggregateByDate(priceHistory) {
    if (!priceHistory || priceHistory.length === 0) return [];

    const grouped = priceHistory.reduce((acc, { date, price }) => {
        if (price == null) return acc;
        const day = date?.slice(0, 10);
        if (!day) return acc;
        if (!acc[day]) acc[day] = { sum: 0, count: 0 };
        acc[day].sum += price;
        acc[day].count += 1;
        return acc;
    }, {});

    return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([date, { sum, count }]) => ({
            date,
            price: Math.round(sum / count),
        }));
}

// 전일 대비 변동 계산
function getPriceTrend(weekly) {
    if (!weekly) return null;
    const history = aggregateByDate(weekly.priceHistory);
    if (history.length < 2) return null;
    const last = history[history.length - 1].price;
    const prev = history[history.length - 2].price;
    const diff = last - prev;
    if (diff > 0) return { dir: "up",   label: `+${diff.toLocaleString()}원`, color: "text-red-500" };
    if (diff < 0) return { dir: "down", label: `${diff.toLocaleString()}원`,  color: "text-blue-500" };
    return { dir: "flat", label: "변동없음", color: "text-gray-400" };
}

// 미니 바 차트
function MiniBarChart({ history, marketType }) {
    if (!history || history.length === 0) return null;
    const values = history.map(d => d.price ?? 0);
    const max = Math.max(...values, 1);
    const activeColor  = marketType === "WHOLESALE" ? "bg-blue-500"  : "bg-green-500";
    const inactiveColor = marketType === "WHOLESALE" ? "bg-blue-100" : "bg-green-100";
    return (
        <div className="flex items-end gap-1 h-12">
            {values.map((v, i) => (
                <div key={i} className="flex-1">
                    <div
                        className={`w-full rounded-t-sm transition-all ${
                            i === values.length - 1 ? activeColor : inactiveColor
                        }`}
                        style={{ height: `${Math.max((v / max) * 44, 2)}px` }}
                    />
                </div>
            ))}
        </div>
    );
}

// 품목 카드
function PriceCard({ item, onClick, isSelected, marketType }) {
    const [retail, setRetail] = useState(null);
    const [weekly, setWeekly] = useState(null);
    const [status, setStatus] = useState("idle");

    useEffect(() => {
        setStatus("loading");
        Promise.all([
            getLatestPrice(item.itemCode, item.kindCode, marketType),
            getWeeklyPrice(item.itemCode, item.kindCode, marketType),
        ])
            .then(([latestRes, weeklyRes]) => {
                setRetail(latestRes.data);
                setWeekly(weeklyRes.data);
                setStatus("ok");
            })
            .catch(() => setStatus("error"));
    }, [item.itemCode, item.kindCode, marketType]);

    const trend = getPriceTrend(weekly);
    const aggregatedHistory = aggregateByDate(weekly?.priceHistory);

    const price = retail?.currentPrice;
    const unit  = retail?.unit ?? weekly?.unit;

    const isWholesale = marketType === "WHOLESALE";

    return (
        <div
            onClick={() => onClick(item, retail, weekly)}
            className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isSelected
                    ? isWholesale
                        ? "border-blue-400 ring-2 ring-blue-100"
                        : "border-green-400 ring-2 ring-green-100"
                    : "border-gray-100"
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
            {status === "ok" && (
                <>
                    <div className="mb-3 text-xs">
                        <div className={`rounded-xl p-2 text-center ${isWholesale ? "bg-blue-50" : "bg-green-50"}`}>
                            <p className="text-gray-400 mb-0.5">현재가</p>
                            <p className={`font-bold ${isWholesale ? "text-blue-600" : "text-green-600"}`}>
                                {price != null ? `${price.toLocaleString()}원` : "-"}
                            </p>
                        </div>
                    </div>
                    <MiniBarChart history={aggregatedHistory} marketType={marketType} />
                    <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                        <span>6일 전</span><span>오늘</span>
                    </div>
                    <p className="text-[10px] text-gray-300 mt-1.5 text-right">
                        단위: {unit ?? "-"}
                    </p>
                </>
            )}
        </div>
    );
}

// 상세 패널
function DetailPanel({ item, latest, weekly, onClose, marketType }) {
    if (!item) return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
            <span className="text-4xl mb-3">📊</span>
            <p className="text-sm text-gray-400">품목을 선택하면<br />상세 가격 정보를 볼 수 있어요</p>
        </div>
    );

    const isWholesale = marketType === "WHOLESALE";
    const trend   = getPriceTrend(weekly);
    const history = aggregateByDate(weekly?.priceHistory);
    const max     = Math.max(...history.map(d => d.price ?? 0), 1);

    // 7일 평균: priceHistory 기준 직접 계산
    const avgPrice = history.length > 0
        ? Math.round(history.reduce((sum, d) => sum + (d.price ?? 0), 0) / history.length)
        : null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                        <h2 className="text-base font-bold text-gray-800">{item.name}</h2>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            {weekly?.kindName && `${weekly.kindName} · `}
                            단위: {weekly?.unit ?? "-"}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                isWholesale
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-green-100 text-green-600"
                            }`}>
                                {isWholesale ? "도매" : "소매"}
                            </span>
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg">✕</button>
            </div>

            {/* 현재가 + 7일 평균 */}
            {weekly && (
                <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-2xl p-4 text-center ${isWholesale ? "bg-blue-50" : "bg-green-50"}`}>
                        <p className="text-xs text-gray-400 mb-1">현재가</p>
                        <p className={`text-2xl font-bold ${isWholesale ? "text-blue-600" : "text-green-600"}`}>
                            {weekly.currentPrice != null
                                ? weekly.currentPrice.toLocaleString() : "-"}
                        </p>
                        <p className={`text-xs ${isWholesale ? "text-blue-400" : "text-green-400"}`}>원</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">7일 평균</p>
                        <p className="text-2xl font-bold text-gray-600">
                            {avgPrice != null ? avgPrice.toLocaleString() : "-"}
                        </p>
                        <p className="text-xs text-gray-400">원</p>
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
                    <span className="font-medium">전일 대비</span>
                    <span className="font-bold">
                        {trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "—"} {trend.label}
                    </span>
                </div>
            )}

            {/* 변동 상태 배지 */}
            {weekly?.changeStatus && (
                <div className="flex justify-end">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        weekly.changeStatus === "SHARP_RISE" ? "bg-red-100 text-red-600" :
                        weekly.changeStatus === "RISE"       ? "bg-orange-100 text-orange-600" :
                        weekly.changeStatus === "STABLE"     ? "bg-gray-100 text-gray-500" :
                        weekly.changeStatus === "FALL"       ? "bg-blue-100 text-blue-600" :
                        "bg-indigo-100 text-indigo-600"
                    }`}>
                        {{
                            SHARP_RISE: "급등 +5%↑",
                            RISE:       "상승",
                            STABLE:     "보합",
                            FALL:       "하락",
                            SHARP_FALL: "급락 -5%↓",
                        }[weekly.changeStatus]}
                    </span>
                </div>
            )}

            {/* 주간 바 차트 */}
            {history.length > 0 ? (
                <div className="overflow-visible">
                    <h3 className="text-xs font-semibold text-gray-500 mb-3">📈 최근 7일 가격 추이</h3>
                    <div className="flex items-end gap-2 h-28 overflow-visible">
                        {history.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group relative">
                                <div className="hidden group-hover:flex flex-col items-center absolute bottom-full mb-1 bg-gray-800 text-white text-[10px] rounded-lg px-2 py-1 z-10 whitespace-nowrap">
                                    <span>{d.price?.toLocaleString()}원</span>
                                </div>
                                <div
                                    className={`w-full rounded-t-sm transition-colors ${
                                        i === history.length - 1
                                            ? isWholesale
                                                ? "bg-blue-400 hover:bg-blue-500"
                                                : "bg-green-400 hover:bg-green-500"
                                            : isWholesale
                                                ? "bg-blue-200 hover:bg-blue-300"
                                                : "bg-green-200 hover:bg-green-300"
                                    }`}
                                    style={{ height: `${Math.max((d.price / max) * 96, 2)}px` }}
                                />
                                <span className="text-[9px] text-gray-300 mt-1">
                                    {d.date?.slice(5)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
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
    const [marketType,     setMarketType]     = useState("RETAIL");
    const [selectedItem,   setSelectedItem]   = useState(null);
    const [selectedLatest, setSelectedLatest] = useState(null);
    const [selectedWeekly, setSelectedWeekly] = useState(null);

    const handleTypeChange = (type) => {
        setMarketType(type);
        setSelectedItem(null);
        setSelectedLatest(null);
        setSelectedWeekly(null);
    };

    const handleCardClick = (item, latest, weekly) => {
        if (selectedItem?.name === item.name) {
            setSelectedItem(null); setSelectedLatest(null); setSelectedWeekly(null);
        } else {
            setSelectedItem(item); setSelectedLatest(latest); setSelectedWeekly(weekly);
        }
    };

    return (
        <div className="max-w-screen-xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 text-sm">← 홈</button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800">🏪 농산물 시세</h1>
                        <p className="text-xs text-gray-400 mt-0.5">매일 오전 6시 자동 업데이트 · KAMIS 공공데이터 기준</p>
                    </div>
                </div>

                {/* 소매/도매 토글 */}
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                    <button
                        onClick={() => handleTypeChange("RETAIL")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            marketType === "RETAIL"
                                ? "bg-white text-green-600 shadow-sm"
                                : "text-gray-400 hover:text-gray-600"
                        }`}
                    >
                        🛒 소매가
                    </button>
                    <button
                        onClick={() => handleTypeChange("WHOLESALE")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            marketType === "WHOLESALE"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-400 hover:text-gray-600"
                        }`}
                    >
                        🏭 도매가
                    </button>
                </div>
            </div>

            {/* 본문 */}
            <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-grow">
                    {ITEMS.map(item => (
                        <PriceCard
                            key={`${item.name}-${marketType}`}
                            item={item}
                            marketType={marketType}
                            onClick={handleCardClick}
                            isSelected={selectedItem?.name === item.name}
                        />
                    ))}
                </div>
                <div className="w-full lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-4">
                    <DetailPanel
                        item={selectedItem}
                        latest={selectedLatest}
                        weekly={selectedWeekly}
                        marketType={marketType}
                        onClose={() => {
                            setSelectedItem(null); setSelectedLatest(null); setSelectedWeekly(null);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default MarketPricePage;