    import { useState, useEffect } from "react";
    import { getAllSpeciesApi } from "../../api/speciesApi";
    import { createPlantApi } from "../../api/plantApi";

    const CATEGORY_FILTERS = ["전체", "채소", "허브", "과일", "관상식물"];

    const CATEGORY_MAP = {
        "채소": "VEGETABLE",
        "과일": "FRUIT",
        "허브": "HERB",
        "관상식물": "ORNAMENTAL",
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

    const DIFFICULTY_LABEL = {
        EASY: "쉬움",
        NORMAL: "보통",
        HARD: "어려움",
    };

    const DIFFICULTY_COLOR = {
        EASY: "bg-green-100 text-green-700",
        NORMAL: "bg-yellow-100 text-yellow-700",
        HARD: "bg-red-100 text-red-600",
    };

    function SelectPlantModal({ serialNumber, portIndex, onClose, onSuccess }) {
        const [species, setSpecies] = useState([]);
        const [selected, setSelected] = useState(null);
        const [search, setSearch] = useState("");
        const [category, setCategory] = useState("전체");
        const [plantName, setPlantName] = useState("");
        const [loading, setLoading] = useState(false);
        const [fetchLoading, setFetchLoading] = useState(true);
        const [error, setError] = useState("");

        useEffect(() => {
            getAllSpeciesApi()
                .then(res => setSpecies(res.data))
                .catch(() => setSpecies([]))
                .finally(() => setFetchLoading(false));
        }, []);

        const handleSelect = (sp) => {
            setSelected(sp);
            setPlantName(sp.name || sp.koreanName || "");
            setError("");
        };

        const filtered = species.filter(sp => {
            const matchSearch = (sp.name || "").includes(search);
            const matchCategory = category === "전체" || sp.category === CATEGORY_MAP[category];
            return matchSearch && matchCategory;
        });

        const handleSubmit = async () => {
            if (!selected) return;
            if (!plantName.trim()) {
                setError("식물 이름을 입력해주세요.");
                return;
            }
            setLoading(true);
            setError("");
            try {
                await createPlantApi({
                    name: plantName.trim(),
                    plantStage: "SEED",
                    plantedAt: new Date().toISOString(),
                    germinatedAt: null,
                    maturedAt: null,
                    speciesId: selected.id,
                    serialNumber: serialNumber,
                    portIndex: portIndex,
                });
                onSuccess();
                onClose();
            } catch (err) {
                setError(err.response?.data?.message || err.response?.data || "식물 등록에 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                {/* 모달 전체: 고정 높이 */}
                <div
                    className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col overflow-hidden"
                    style={{ height: "600px" }}
                >
                    {/* 헤더 - 고정 */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">←</button>
                        <h2 className="text-base font-bold text-gray-800">식물 선택</h2>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-sm font-semibold text-green-600">🌱 GrowLab</span>
                        </div>
                    </div>

                    {/* 바디 - 남은 높이 전부 차지, 좌우 분할 */}
                    <div className="flex flex-1 min-h-0">

                        {/* 왼쪽: 검색 + 목록 */}
                        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">
                            {/* 검색 - 고정 */}
                            <div className="flex-shrink-0 px-4 pt-4 pb-2">
                                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-400 text-sm">🔍</span>
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="식물 이름으로 검색..."
                                        className="flex-1 text-sm focus:outline-none bg-transparent"
                                    />
                                </div>
                            </div>

                            {/* 카테고리 탭 - 고정 */}
                            <div className="flex-shrink-0 flex gap-2 px-4 pb-3 flex-wrap">
                                {CATEGORY_FILTERS.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                            category === cat
                                                ? "bg-green-600 text-white"
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

                            {/* 개수 - 고정 */}
                            <div className="flex-shrink-0 px-4 pb-2">
                                <div className="text-xs text-gray-400">
                                    재배 가능한 식물 <span className="font-semibold">{filtered.length}가지</span>
                                </div>
                            </div>

                            {/* 식물 그리드 - 스크롤 */}
                            <div className="flex-1 overflow-y-auto px-4 pb-4">
                                {fetchLoading ? (
                                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">불러오는 중...</div>
                                ) : filtered.length === 0 ? (
                                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">검색 결과가 없어요</div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                        {filtered.map(sp => {
                                            const emoji = SPECIES_EMOJI[sp.name || sp.koreanName] || "🌱";
                                            const isSelected = selected?.id === sp.id;
                                            const diffKey = sp.difficulty || "NORMAL";
                                            return (
                                                <button
                                                    key={sp.id}
                                                    onClick={() => handleSelect(sp)}
                                                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                                                        isSelected
                                                            ? "border-green-500 bg-green-50"
                                                            : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                                                    )}
                                                    <span className="text-3xl">{emoji}</span>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-800">{sp.name || sp.koreanName}</div>
                                                        <div className="text-xs text-gray-400">{sp.englishName}</div>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLOR[diffKey] || DIFFICULTY_COLOR.NORMAL}`}>
                                                        {DIFFICULTY_LABEL[diffKey] || "보통"}
                                                    </span>
                                                    {sp.growthDays && (
                                                        <div className="text-xs text-gray-400">⏱ {sp.growthDays}일</div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 오른쪽: 상세 정보 - 스크롤 */}
                        <div className="w-64 flex-shrink-0 overflow-y-auto p-5">
                            {!selected ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                    <div className="text-5xl">🌱</div>
                                    <p className="text-sm text-gray-400 leading-relaxed">식물을 선택하면<br />상세 정보가 표시됩니다</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-4xl">
                                            {SPECIES_EMOJI[selected.name || selected.koreanName] || "🌱"}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-base">{selected.name || selected.koreanName}</div>
                                            <div className="text-xs text-gray-400">{selected.englishName}</div>
                                        </div>
                                    </div>

                                    {selected.description && (
                                        <p className="text-xs text-gray-500 leading-relaxed text-center">{selected.description}</p>
                                    )}

                                    <div className="flex flex-col gap-2">
                                        {selected.growthDays && (
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                                <div className="text-xs text-gray-400">⏱ 재배 기간</div>
                                                <div className="text-sm font-bold text-gray-700 mt-0.5">{selected.growthDays}일</div>
                                            </div>
                                        )}
                                        {selected.difficulty && (
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                                <div className="text-xs text-gray-400">🧩 난이도</div>
                                                <div className="text-sm font-bold text-gray-700 mt-0.5">{DIFFICULTY_LABEL[selected.difficulty] || selected.difficulty}</div>
                                            </div>
                                        )}
                                        {selected.aiPromptGuideline && (
                                            <p className="text-xs text-gray-500 leading-relaxed text-center">{selected.aiPromptGuideline}</p>
                                        )}
                                        {selected.temperature && (
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                                <div className="text-xs text-gray-400">🌡 최적 온도</div>
                                                <div className="text-sm font-bold text-gray-700 mt-0.5">{selected.temperature}</div>
                                            </div>
                                        )}
                                        {selected.waterRequirement && (
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                                <div className="text-xs text-gray-400">💧 수분 요구</div>
                                                <div className="text-sm font-bold text-gray-700 mt-0.5">{selected.waterRequirement}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">내 식물 이름</label>
                                        <input
                                            type="text"
                                            value={plantName}
                                            onChange={e => setPlantName(e.target.value)}
                                            placeholder="예: 우리집 딸기"
                                            maxLength={20}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">최대 20자</p>
                                    </div>

                                    {error && (
                                        <div className="bg-red-50 text-red-500 text-xs rounded-lg px-3 py-2">{error}</div>
                                    )}

                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                                    >
                                        {loading ? "등록 중..." : "이 식물로 재배 시작!"}
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