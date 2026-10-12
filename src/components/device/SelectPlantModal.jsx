import { useState, useEffect } from "react";
import { getAllSpeciesApi } from "../../api/speciesApi";
import { createPlantApi, deletePlantApi } from "../../api/plantApi";
import { updatePortStatusApi } from "../../api/deviceApi";
import { checkSharedEnvironment } from "../../utils/sharedEnvironment";
import { toLocalISO } from "../../utils/datetime";

const CATEGORY_FILTERS = ["전체", "채소", "허브", "과일", "관상식물"];

const CATEGORY_MAP = {
    "채소": "VEGETABLE",
    "허브": "HERB",
    "과일": "FRUIT",
    "관상식물": "ORNAMENTAL",
};

const SPECIES_EMOJI = {
    "방울토마토": "🍅",
    "청상추":    "🥬",
    "적상추":    "🥬",
    "딸기":      "🍓",
    "파프리카":  "🌶️",
    "풋고추":    "🌶️",
    "고추":      "🌶️",
    "블루베리":  "🫐",
    "시금치":    "🥬",
    "토마토":    "🍅",
    "오이":      "🥒",
    "피망":      "🫑",
    "깻잎":      "🍃",
    "청경채":    "🥬",
    "브로콜리":  "🥦",
    "바질":      "🌿",
    "페퍼민트":  "🌿",
    "장미":      "🌹",
    "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

const DIFFICULTY_LABEL = { EASY: "쉬움", NORMAL: "보통", HARD: "어려움" };
const DIFFICULTY_COLOR = {
    EASY:   "bg-brand-cream text-brand",
    NORMAL: "bg-amber-50 text-amber-700",
    HARD:   "bg-red-100 text-red-600",
};

function SelectPlantModal({ serialNumber, portIndex, existingPlants = [], onClose, onSuccess }) {
    const [species, setSpecies]         = useState([]);
    const [selected, setSelected]       = useState(null);
    const [search, setSearch]           = useState("");
    const [category, setCategory]       = useState("전체");
    const [plantName, setPlantName]     = useState("");
    const [loading, setLoading]         = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [error, setError]             = useState("");

    useEffect(() => {
        getAllSpeciesApi()
            .then(res => setSpecies(res.data))
            .catch(() => setSpecies([]))
            .finally(() => setFetchLoading(false));
    }, []);

    const handleSelect = (sp) => {
        setSelected(sp);
        const previous = existingPlants.find(plant => plant.speciesId === sp.id);
        setPlantName(previous?.name || sp.name || sp.koreanName || "");
        setError("");
    };

    const filtered = species.filter(sp => {
        const matchSearch   = (sp.name || "").includes(search);
        const matchCategory = category === "전체" || sp.category === CATEGORY_MAP[category];
        return matchSearch && matchCategory;
    });

    const handleSubmit = async () => {
        if (!selected) return;
        const compatibility = checkSharedEnvironment(selected, existingPlants, species);
        if (!compatibility.compatible) { setError(compatibility.reason); return; }
        if (!plantName.trim()) {
            setError("식물 이름을 입력해주세요.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const created = await createPlantApi({
                    name:        plantName.trim(),
                    stageIndex:  0,
                    plantedAt:   toLocalISO(),
                    germinatedAt: null,
                    maturedAt:   null,
                    speciesId:   selected.id,
                    serialNumber,
                    portIndex,
                });
                try {
                    await updatePortStatusApi(serialNumber, portIndex, true);
                } catch (portError) {
                    // 포트 활성화에 실패하면 식물 등록도 되돌려 빈 포트로 유지한다.
                    try { await deletePlantApi(created.data.id); } catch (rollbackError) {
                        console.error("[Plant rollback]", rollbackError);
                    }
                    throw portError;
                }
                await onSuccess();
                onClose();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data ||
                "처리에 실패했습니다."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl w-full max-w-col-8 shadow-xl flex flex-col overflow-hidden"
                style={{ height: "600px" }}
            >
                {/* 헤더 */}
                <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-sub1 ">←</button>
                    <h2 className="text-body1 font-bold text-gray-800">식물 선택</h2>
                    <span className="text-caption text-brand bg-brand-cream px-2 py-1 rounded-full">
                        {"P" + (portIndex + 1) + "에 심을 품종"}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-body2 font-bold text-brand">🌱 GrowLab</span>
                    </div>
                </div>

                {/* 바디 */}
                <div className="flex flex-1 min-h-0">

                    {/* 왼쪽: 검색 + 목록 */}
                    <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">
                        <div className="flex-shrink-0 px-4 pt-4 pb-2">
                            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                                <span className="text-gray-500 text-body2">🔍</span>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="식물 이름으로 검색..."
                                    className="flex-1 text-body2 focus:outline-none bg-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex-shrink-0 flex gap-2 px-4 pb-3 flex-wrap">
                            {CATEGORY_FILTERS.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-3 py-2 rounded-full text-caption font-medium transition-colors ${
                                        category === cat
                                            ? "bg-brand text-white"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    }`}
                                >
                                    {cat === "전체" && "🌿 "}
                                    {cat === "채소" && "🥬 "}
                                    {cat === "허브" && "🌿 "}
                                    {cat === "과일" && "🍓 "}
                                    {cat === "관상식물" && "🌸 "}
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="flex-shrink-0 px-4 pb-2">
                            <div className="text-caption text-gray-500">
                                재배 가능한 식물 <span className="font-bold">{filtered.length}가지</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            {fetchLoading ? (
                                <div className="flex items-center justify-center h-32 text-gray-500 text-body2">불러오는 중...</div>
                            ) : filtered.length === 0 ? (
                                <div className="flex items-center justify-center h-32 text-gray-500 text-body2">검색 결과가 없어요</div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {filtered.map(sp => {
                                        const emoji      = SPECIES_EMOJI[sp.name || sp.koreanName] || "🌱";
                                        const isSelected = selected?.id === sp.id;
                                        const diffKey    = sp.difficulty || "NORMAL";
                                        const compatibility = checkSharedEnvironment(sp, existingPlants, species);
                                        return (
                                            <button
                                                key={sp.id}
                                                onClick={() => handleSelect(sp)}
                                                disabled={!compatibility.compatible}
                                                title={compatibility.reason || ""}
                                                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                                                    !compatibility.compatible
                                                        ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                                        : isSelected
                                                            ? "border-brand bg-brand-cream"
                                                            : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                                                }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 bg-brand rounded-full flex items-center justify-center text-white text-caption">✓</div>
                                                )}
                                                <span className="text-h2">{emoji}</span>
                                                <div>
                                                    <div className="text-body2 font-bold text-gray-800">{sp.name || sp.koreanName}</div>
                                                    <div className="text-caption text-gray-500">{sp.englishName}</div>
                                                </div>
                                                <span className={`text-caption px-2 py-1 rounded-full font-medium ${DIFFICULTY_COLOR[diffKey] || DIFFICULTY_COLOR.NORMAL}`}>
                                                    {DIFFICULTY_LABEL[diffKey] || "보통"}
                                                </span>
                                                {!compatibility.compatible && <div className="text-caption text-red-600">{compatibility.reason}</div>}
                                                {sp.growthDays && (
                                                    <div className="text-caption text-gray-500">⏱ {sp.growthDays}일</div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 오른쪽: 상세 정보 */}
                    <div className="w-64 flex-shrink-0 overflow-y-auto p-5">
                        {!selected ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                <div className="text-h1">🌱</div>
                                <p className="text-body2 text-gray-500 ">식물을 선택하면<br />상세 정보가 표시됩니다</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-cream flex items-center justify-center text-h1">
                                        {SPECIES_EMOJI[selected.name || selected.koreanName] || "🌱"}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-body1">{selected.name || selected.koreanName}</div>
                                        <div className="text-caption text-gray-500">{selected.englishName}</div>
                                    </div>
                                </div>

                                {selected.description && (
                                    <p className="text-caption text-gray-500  text-center">{selected.description}</p>
                                )}

                                <div className="flex flex-col gap-2">
                                    {selected.growthDays && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className="text-caption text-gray-500">⏱ 재배 기간</div>
                                            <div className="text-body2 font-bold text-gray-700 mt-1">{selected.growthDays}일</div>
                                        </div>
                                    )}
                                    {selected.difficulty && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className="text-caption text-gray-500">🧩 난이도</div>
                                            <div className="text-body2 font-bold text-gray-700 mt-1">{DIFFICULTY_LABEL[selected.difficulty] || selected.difficulty}</div>
                                        </div>
                                    )}
                                    {/* ✅ 이 품종의 생육 단계 목록 표시 */}
                                    {selected.stageNames && selected.stageNames.length > 0 && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className="text-caption text-gray-500">🌾 생육 단계 ({selected.stageNames.length}단계)</div>
                                            <div className="text-caption font-medium text-gray-700 mt-1">
                                                {selected.stageNames.join(" → ")}
                                            </div>
                                        </div>
                                    )}
                                    {/* ✅ 이 품종의 생육 단계 목록 표시 */}
                                    {selected.stageNames && selected.stageNames.length > 0 && (
                                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                            <div className="text-xs text-gray-400">🌾 생육 단계 ({selected.stageNames.length}단계)</div>
                                            <div className="text-xs font-medium text-gray-700 mt-0.5">
                                                {selected.stageNames.join(" → ")}
                                            </div>
                                        </div>
                                    )}
                                    {selected.aiPromptGuideline && (
                                        <p className="text-caption text-gray-500  text-center">{selected.aiPromptGuideline}</p>
                                    )}
                                    {selected.temperature && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className="text-caption text-gray-500">🌡 최적 온도</div>
                                            <div className="text-body2 font-bold text-gray-700 mt-1">{selected.temperature}</div>
                                        </div>
                                    )}
                                    {selected.waterRequirement && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className="text-caption text-gray-500">💧 수분 요구</div>
                                            <div className="text-body2 font-bold text-gray-700 mt-1">{selected.waterRequirement}</div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                        <label className="block text-caption font-medium text-gray-600 mb-1">내 식물 이름</label>
                                        <input
                                            type="text"
                                            value={plantName}
                                            disabled={existingPlants.some(plant => plant.speciesId === selected.id)}
                                            onChange={e => setPlantName(e.target.value)}
                                            placeholder="예: 우리집 딸기"
                                            maxLength={20}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf"
                                        />
                                        <p className="text-caption text-gray-500 mt-1">{existingPlants.some(plant => plant.speciesId === selected.id) ? "같은 기기의 동일 품종 별명이 자동으로 적용됩니다." : "최대 20자 · 같은 품종을 추가하면 이 이름을 사용해요."}</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 text-caption rounded-lg px-3 py-2">{error}</div>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full bg-brand hover:bg-brand-deep disabled:bg-brand-olive text-white font-medium py-3 rounded-xl text-body2 transition-colors"
                                >
                                    {loading ? "처리 중..." : "이 식물로 재배 시작!"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SelectPlantModal;
