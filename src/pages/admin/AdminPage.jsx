import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    getAllDevicesAdminApi,
    adminCreateDeviceApi,
    adminDeleteDeviceApi,
} from "../../api/deviceApi";
import {
    getAllSpeciesApi,
    createSpeciesApi,
    deleteSpeciesApi,
} from "../../api/speciesApi";

const FILTERS = [
    { key: "all", label: "전체" },
    { key: "unregistered", label: "미배정" },
    { key: "registered", label: "배정됨" },
];

const CATEGORY_OPTIONS = [
    { value: "VEGETABLE", label: "채소" },
    { value: "FRUIT", label: "과일" },
    { value: "HERB", label: "허브" },
    { value: "ORNAMENTAL", label: "관상식물" },
];

const DIFFICULTY_OPTIONS = [
    { value: "EASY", label: "쉬움" },
    { value: "NORMAL", label: "보통" },
    { value: "HARD", label: "어려움" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map(o => [o.value, o.label]));
const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTY_OPTIONS.map(o => [o.value, o.label]));

const EMPTY_SPECIES_FORM = {
    name: "",
    daysToMature: "",
    category: "VEGETABLE",
    difficulty: "NORMAL",
    aiPromptGuideline: "",
};

function AdminPage() {
    const navigate = useNavigate();

    // ────────────────────────────────
    // 기기 시리얼 관리
    // ────────────────────────────────
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState("");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    const [serial, setSerial] = useState("");
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createMessage, setCreateMessage] = useState("");

    // ────────────────────────────────
    // 품종 관리
    // ────────────────────────────────
    const [speciesList, setSpeciesList] = useState([]);
    const [speciesLoading, setSpeciesLoading] = useState(true);
    const [speciesListError, setSpeciesListError] = useState("");
    const [speciesSearch, setSpeciesSearch] = useState("");

    const [speciesForm, setSpeciesForm] = useState(EMPTY_SPECIES_FORM);
    const [speciesCreateLoading, setSpeciesCreateLoading] = useState(false);
    const [speciesCreateError, setSpeciesCreateError] = useState("");
    const [speciesCreateMessage, setSpeciesCreateMessage] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        if (!token || role !== "ROLE_ADMIN") {
            navigate("/");
            return;
        }
        fetchDevices();
        fetchSpecies();
    }, [navigate]);

    // ── 기기 관련 함수 ──
    const fetchDevices = async () => {
        setLoading(true);
        setListError("");
        try {
            const res = await getAllDevicesAdminApi();
            setDevices(res.data ?? []);
        } catch (err) {
            console.error(err);
            setListError("기기 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const trimmed = serial.trim().toUpperCase();
        if (!trimmed) {
            setCreateError("시리얼 번호를 입력해주세요.");
            return;
        }

        setCreateLoading(true);
        setCreateError("");
        setCreateMessage("");
        try {
            const res = await adminCreateDeviceApi(trimmed);
            setCreateMessage(res.data || `${trimmed} 등록 완료!`);
            setSerial("");
            fetchDevices();
        } catch (err) {
            setCreateError(
                err.response?.data ||
                err.response?.data?.message ||
                "시리얼 등록에 실패했습니다. 이미 등록된 번호일 수 있어요."
            );
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async (serialNumber, registered) => {
        const confirmMsg = registered
            ? `${serialNumber}는 사용자에게 배정된 기기입니다. 정말 완전히 삭제할까요? 사용자 데이터(식물, 일지 등)도 함께 삭제될 수 있습니다.`
            : `${serialNumber} 시리얼을 삭제할까요?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            await adminDeleteDeviceApi(serialNumber);
            setDevices(prev => prev.filter(d => d.serialNumber !== serialNumber));
        } catch (err) {
            console.error(err);
            alert("삭제에 실패했습니다.");
        }
    };

    const filtered = useMemo(() => {
        return devices.filter(d => {
            const matchesFilter =
                filter === "all" ? true :
                filter === "registered" ? d.registered :
                !d.registered;

            const q = search.trim().toLowerCase();
            const matchesSearch = !q ||
                d.serialNumber?.toLowerCase().includes(q) ||
                d.deviceNickname?.toLowerCase().includes(q) ||
                d.ownerUsername?.toLowerCase().includes(q);

            return matchesFilter && matchesSearch;
        });
    }, [devices, search, filter]);

    const registeredCount = devices.filter(d => d.registered).length;
    const unregisteredCount = devices.length - registeredCount;
    const isScrollable = filtered.length > 8;

    // ── 품종 관련 함수 ──
    const fetchSpecies = async () => {
        setSpeciesLoading(true);
        setSpeciesListError("");
        try {
            const res = await getAllSpeciesApi();
            setSpeciesList(res.data ?? []);
        } catch (err) {
            console.error(err);
            setSpeciesListError("품종 목록을 불러오지 못했습니다.");
        } finally {
            setSpeciesLoading(false);
        }
    };

    const handleSpeciesFormChange = (field, value) => {
        setSpeciesForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCreateSpecies = async (e) => {
        e.preventDefault();

        const name = speciesForm.name.trim();
        const days = Number(speciesForm.daysToMature);

        if (!name) {
            setSpeciesCreateError("품종 이름을 입력해주세요.");
            return;
        }
        if (!days || days <= 0) {
            setSpeciesCreateError("성숙 기간은 1 이상의 숫자로 입력해주세요.");
            return;
        }

        setSpeciesCreateLoading(true);
        setSpeciesCreateError("");
        setSpeciesCreateMessage("");
        try {
            await createSpeciesApi({
                name,
                daysToMature: days,
                category: speciesForm.category,
                difficulty: speciesForm.difficulty,
                aiPromptGuideline: speciesForm.aiPromptGuideline.trim() || null,
            });
            setSpeciesCreateMessage(`'${name}' 품종이 등록되었습니다.`);
            setSpeciesForm(EMPTY_SPECIES_FORM);
            fetchSpecies();
        } catch (err) {
            setSpeciesCreateError(
                err.response?.data?.message ||
                err.response?.data ||
                "품종 등록에 실패했습니다. 이미 존재하는 이름일 수 있어요."
            );
        } finally {
            setSpeciesCreateLoading(false);
        }
    };

    const handleDeleteSpecies = async (id, name) => {
        if (!window.confirm(`'${name}' 품종을 삭제할까요?`)) return;

        try {
            await deleteSpeciesApi(id);
            setSpeciesList(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error(err);
            alert(
                err.response?.data?.message ||
                err.response?.data ||
                "삭제에 실패했습니다. 이 품종을 사용하는 식물이 있으면 삭제할 수 없어요."
            );
        }
    };

    const filteredSpecies = useMemo(() => {
        const q = speciesSearch.trim().toLowerCase();
        if (!q) return speciesList;
        return speciesList.filter(s => s.name?.toLowerCase().includes(q));
    }, [speciesList, speciesSearch]);

    const isSpeciesScrollable = filteredSpecies.length > 8;

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate("/mypage")} className="text-gray-400 hover:text-gray-600 text-sm">← 마이페이지</button>
                    <h1 className="text-xl font-bold text-gray-800">🛠 관리자페이지</h1>
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">ADMIN</span>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <div className="text-[11px] sm:text-xs text-gray-400 mb-1">전체 시리얼</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-800">{devices.length}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <div className="text-[11px] sm:text-xs text-gray-400 mb-1">미배정</div>
                    <div className="text-xl sm:text-2xl font-bold text-yellow-500">{unregisteredCount}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <div className="text-[11px] sm:text-xs text-gray-400 mb-1">배정됨</div>
                    <div className="text-xl sm:text-2xl font-bold text-green-600">{registeredCount}</div>
                </div>
            </div>

            {/* 시리얼 등록 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <h2 className="text-base font-bold text-gray-800 mb-1">기기 시리얼 번호 등록</h2>
                <p className="text-xs text-gray-400 mb-4">
                    여기서 등록한 시리얼 번호만 사용자가 홈 화면에서 "+ 기기 추가"로 자신의 기기로 등록할 수 있어요.
                </p>

                {createError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{createError}</div>
                )}
                {createMessage && (
                    <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-2 mb-3">{createMessage}</div>
                )}

                <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={serial}
                        onChange={(e) => setSerial(e.target.value)}
                        placeholder="예: GROWLAB-A001"
                        className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button
                        type="submit"
                        disabled={createLoading}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                        {createLoading ? "등록 중..." : "등록"}
                    </button>
                </form>
                <p className="text-xs text-gray-400 mt-2">
                    * 사용자가 홈에서 기기를 추가할 때 입력하는 시리얼 번호와 형식이 동일해야 합니다 (예: GROWLAB- 접두사 포함 여부 확인).
                </p>
            </div>

            {/* 기기 목록 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-base font-bold text-gray-800">전체 기기 목록</h2>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="시리얼, 소유자 검색..."
                            className="flex-1 sm:flex-none border border-gray-200 rounded-lg px-3 py-1.5 text-xs sm:w-48 focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                        <button onClick={fetchDevices} className="text-xs text-gray-400 hover:text-green-600 px-2 py-1.5 border border-gray-200 rounded-lg whitespace-nowrap">
                            ↻ 새로고침
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                                filter === f.key
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                        >{f.label}</button>
                    ))}
                </div>

                {listError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{listError}</div>
                )}

                {loading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 text-sm">
                        {devices.length === 0 ? "아직 등록된 시리얼이 없어요" : "검색 결과가 없어요"}
                    </div>
                ) : (
                    <div className={`overflow-x-auto ${isScrollable ? "max-h-[420px] overflow-y-auto" : ""}`}>
                        <table className="w-full text-sm min-w-[560px]">
                            <thead className={isScrollable ? "sticky top-0 bg-white z-10" : ""}>
                                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                    <th className="py-2 pr-2 font-medium">시리얼 번호</th>
                                    <th className="py-2 pr-2 font-medium">상태</th>
                                    <th className="py-2 pr-2 font-medium">소유자</th>
                                    <th className="py-2 pr-2 font-medium">등록일</th>
                                    <th className="py-2 font-medium text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(d => (
                                    <tr key={d.serialNumber} className="hover:bg-gray-50/50">
                                        <td className="py-3 pr-2 font-medium text-gray-700">{d.serialNumber}</td>
                                        <td className="py-3 pr-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                d.registered ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                                            }`}>
                                                {d.registered ? "배정됨" : "미배정"}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-2 text-gray-500">{d.ownerUsername || "-"}</td>
                                        <td className="py-3 pr-2 text-gray-400 text-xs">{d.createdAt?.slice(0, 10) || "-"}</td>
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(d.serialNumber, d.registered)}
                                                className="text-xs text-red-400 hover:text-red-600 font-medium"
                                            >삭제</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filtered.length > 0 && (
                    <p className="text-xs text-gray-300 mt-3 text-right">
                        총 {filtered.length}개 {isScrollable && "· 스크롤하여 더 보기"}
                    </p>
                )}
            </div>

            {/* ────────────────────────────────
                ✅ 품종 등록
            ──────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <h2 className="text-base font-bold text-gray-800 mb-1">🌱 품종 등록</h2>
                <p className="text-xs text-gray-400 mb-4">
                    여기서 등록한 품종만 사용자가 기기에 대표 품종으로 선택할 수 있어요.
                </p>

                {speciesCreateError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{speciesCreateError}</div>
                )}
                {speciesCreateMessage && (
                    <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-2 mb-3">{speciesCreateMessage}</div>
                )}

                <form onSubmit={handleCreateSpecies} className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">품종 이름</label>
                            <input
                                type="text"
                                value={speciesForm.name}
                                onChange={(e) => handleSpeciesFormChange("name", e.target.value)}
                                placeholder="예: 방울토마토"
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">성숙 기간 (일)</label>
                            <input
                                type="number"
                                min={1}
                                value={speciesForm.daysToMature}
                                onChange={(e) => handleSpeciesFormChange("daysToMature", e.target.value)}
                                placeholder="예: 90"
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
                            <select
                                value={speciesForm.category}
                                onChange={(e) => handleSpeciesFormChange("category", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-700"
                            >
                                {CATEGORY_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">난이도</label>
                            <select
                                value={speciesForm.difficulty}
                                onChange={(e) => handleSpeciesFormChange("difficulty", e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-700"
                            >
                                {DIFFICULTY_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">AI 분석 가이드라인 (선택)</label>
                        <textarea
                            value={speciesForm.aiPromptGuideline}
                            onChange={(e) => handleSpeciesFormChange("aiPromptGuideline", e.target.value)}
                            placeholder="Vision AI가 이 품종의 생육 상태를 분석할 때 참고할 설명을 입력하세요."
                            rows={3}
                            maxLength={500}
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={speciesCreateLoading}
                        className="self-end bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
                    >
                        {speciesCreateLoading ? "등록 중..." : "품종 등록"}
                    </button>
                </form>
            </div>

            {/* ────────────────────────────────
                ✅ 품종 목록
            ──────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-base font-bold text-gray-800">전체 품종 목록</h2>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={speciesSearch}
                            onChange={(e) => setSpeciesSearch(e.target.value)}
                            placeholder="품종 이름 검색..."
                            className="flex-1 sm:flex-none border border-gray-200 rounded-lg px-3 py-1.5 text-xs sm:w-48 focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                        <button onClick={fetchSpecies} className="text-xs text-gray-400 hover:text-green-600 px-2 py-1.5 border border-gray-200 rounded-lg whitespace-nowrap">
                            ↻ 새로고침
                        </button>
                    </div>
                </div>

                {speciesListError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{speciesListError}</div>
                )}

                {speciesLoading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
                ) : filteredSpecies.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 text-sm">
                        {speciesList.length === 0 ? "아직 등록된 품종이 없어요" : "검색 결과가 없어요"}
                    </div>
                ) : (
                    <div className={`overflow-x-auto ${isSpeciesScrollable ? "max-h-[420px] overflow-y-auto" : ""}`}>
                        <table className="w-full text-sm min-w-[560px]">
                            <thead className={isSpeciesScrollable ? "sticky top-0 bg-white z-10" : ""}>
                                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                    <th className="py-2 pr-2 font-medium">품종 이름</th>
                                    <th className="py-2 pr-2 font-medium">카테고리</th>
                                    <th className="py-2 pr-2 font-medium">난이도</th>
                                    <th className="py-2 pr-2 font-medium">성숙 기간</th>
                                    <th className="py-2 font-medium text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredSpecies.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50/50">
                                        <td className="py-3 pr-2 font-medium text-gray-700">{s.name}</td>
                                        <td className="py-3 pr-2 text-gray-500">{CATEGORY_LABEL[s.category] || s.category}</td>
                                        <td className="py-3 pr-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                s.difficulty === "EASY" ? "bg-green-100 text-green-700" :
                                                s.difficulty === "HARD" ? "bg-red-100 text-red-600" :
                                                "bg-yellow-100 text-yellow-700"
                                            }`}>
                                                {DIFFICULTY_LABEL[s.difficulty] || s.difficulty}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-2 text-gray-400 text-xs">{s.daysToMature}일</td>
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => handleDeleteSpecies(s.id, s.name)}
                                                className="text-xs text-red-400 hover:text-red-600 font-medium"
                                            >삭제</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredSpecies.length > 0 && (
                    <p className="text-xs text-gray-300 mt-3 text-right">
                        총 {filteredSpecies.length}개 {isSpeciesScrollable && "· 스크롤하여 더 보기"}
                    </p>
                )}
            </div>
        </div>
    );
}

export default AdminPage;