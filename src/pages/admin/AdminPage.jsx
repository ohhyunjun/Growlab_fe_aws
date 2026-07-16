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
    updateSpeciesApi,
    deleteSpeciesApi,
} from "../../api/speciesApi";
import {
    getAllUsersAdminApi,
    adminDeleteUserApi,
    adminUpdateUserRoleApi,
} from "../../api/userApi";
import {
    getArticlesAdminApi,
    adminDeleteArticleApi,
    getCommentsByArticleApi,
    adminDeleteCommentApi,
} from "../../api/articleApi";

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

const ROLE_FILTERS = [
    { key: "all", label: "전체" },
    { key: "ROLE_ADMIN", label: "관리자" },
    { key: "ROLE_USER", label: "일반회원" },
];

const ARTICLE_PAGE_SIZE = 20;

function AdminPage() {
    const navigate = useNavigate();
    const myUsername = localStorage.getItem("username");

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
    const [editingSpeciesId, setEditingSpeciesId] = useState(null);

    // ────────────────────────────────
    // 회원 관리
    // ────────────────────────────────
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersListError, setUsersListError] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [roleUpdatingId, setRoleUpdatingId] = useState(null);

    // ────────────────────────────────
    // 게시글 + 댓글(게시글별 펼침) 관리
    // ────────────────────────────────
    const [articles, setArticles] = useState([]);
    const [articlePage, setArticlePage] = useState(0);
    const [articleHasMore, setArticleHasMore] = useState(true);
    const [articlesLoading, setArticlesLoading] = useState(true);
    const [articlesLoadingMore, setArticlesLoadingMore] = useState(false);
    const [articlesListError, setArticlesListError] = useState("");
    const [articleSearch, setArticleSearch] = useState("");

    // ✅ 펼쳐진 게시글 id (한 번에 하나만 펼침)
    const [expandedArticleId, setExpandedArticleId] = useState(null);
    // ✅ 게시글별 댓글 캐시: { [articleId]: { loading, error, list } }
    const [articleComments, setArticleComments] = useState({});

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        if (!token || role !== "ROLE_ADMIN") {
            navigate("/");
            return;
        }
        fetchDevices();
        fetchSpecies();
        fetchUsers();
        fetchArticles(0);
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

    const resetSpeciesForm = () => {
        setSpeciesForm(EMPTY_SPECIES_FORM);
        setEditingSpeciesId(null);
        setSpeciesCreateError("");
        setSpeciesCreateMessage("");
    };

    const handleStartEditSpecies = (sp) => {
        setEditingSpeciesId(sp.id);
        setSpeciesForm({
            name: sp.name ?? "",
            daysToMature: sp.daysToMature ?? "",
            category: sp.category ?? "VEGETABLE",
            difficulty: sp.difficulty ?? "NORMAL",
            aiPromptGuideline: sp.aiPromptGuideline ?? "",
        });
        setSpeciesCreateError("");
        setSpeciesCreateMessage("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmitSpecies = async (e) => {
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

        const payload = {
            name,
            daysToMature: days,
            category: speciesForm.category,
            difficulty: speciesForm.difficulty,
            aiPromptGuideline: speciesForm.aiPromptGuideline.trim() || null,
        };

        setSpeciesCreateLoading(true);
        setSpeciesCreateError("");
        setSpeciesCreateMessage("");
        try {
            if (editingSpeciesId) {
                await updateSpeciesApi(editingSpeciesId, payload);
                setSpeciesCreateMessage(`'${name}' 품종이 수정되었습니다.`);
            } else {
                await createSpeciesApi(payload);
                setSpeciesCreateMessage(`'${name}' 품종이 등록되었습니다.`);
            }
            setSpeciesForm(EMPTY_SPECIES_FORM);
            setEditingSpeciesId(null);
            fetchSpecies();
        } catch (err) {
            setSpeciesCreateError(
                err.response?.data?.message ||
                err.response?.data ||
                (editingSpeciesId
                    ? "품종 수정에 실패했습니다."
                    : "품종 등록에 실패했습니다. 이미 존재하는 이름일 수 있어요.")
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
            if (editingSpeciesId === id) resetSpeciesForm();
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

    // ── 회원 관련 함수 ──
    const fetchUsers = async () => {
        setUsersLoading(true);
        setUsersListError("");
        try {
            const res = await getAllUsersAdminApi();
            setUsers(res.data ?? []);
        } catch (err) {
            console.error(err);
            setUsersListError("회원 목록을 불러오지 못했습니다.");
        } finally {
            setUsersLoading(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (user.username === myUsername) return;
        if (!window.confirm(`'${user.username}' 회원을 강제 탈퇴시킬까요? 이 작업은 되돌릴 수 없습니다.`)) return;

        try {
            await adminDeleteUserApi(user.id);
            setUsers(prev => prev.filter(u => u.id !== user.id));
        } catch (err) {
            console.error(err);
            alert(
                err.response?.data?.message ||
                err.response?.data ||
                "탈퇴 처리에 실패했습니다."
            );
        }
    };

    const handleToggleRole = async (user) => {
        if (user.username === myUsername) return;

        const nextRole = user.role === "ROLE_ADMIN" ? "ROLE_USER" : "ROLE_ADMIN";
        const label = nextRole === "ROLE_ADMIN" ? "관리자" : "일반회원";
        if (!window.confirm(`'${user.username}' 회원을 ${label}(으)로 변경할까요?`)) return;

        setRoleUpdatingId(user.id);
        try {
            const res = await adminUpdateUserRoleApi(user.id, nextRole);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: res.data.role } : u));
        } catch (err) {
            console.error(err);
            alert(
                err.response?.data?.message ||
                err.response?.data ||
                "권한 변경에 실패했습니다."
            );
        } finally {
            setRoleUpdatingId(null);
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;

            const q = userSearch.trim().toLowerCase();
            const matchesSearch = !q ||
                u.username?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q);

            return matchesRole && matchesSearch;
        });
    }, [users, userSearch, roleFilter]);

    const adminCount = users.filter(u => u.role === "ROLE_ADMIN").length;
    const isUsersScrollable = filteredUsers.length > 8;

    // ── 게시글 관련 함수 ──
    const fetchArticles = async (page) => {
        if (page === 0) setArticlesLoading(true);
        else setArticlesLoadingMore(true);
        setArticlesListError("");
        try {
            const res = await getArticlesAdminApi(page, ARTICLE_PAGE_SIZE);
            const content = res.data?.content ?? [];
            setArticles(prev => page === 0 ? content : [...prev, ...content]);
            setArticleHasMore(!res.data?.last);
            setArticlePage(page);
        } catch (err) {
            console.error(err);
            setArticlesListError("게시글 목록을 불러오지 못했습니다.");
        } finally {
            setArticlesLoading(false);
            setArticlesLoadingMore(false);
        }
    };

    const handleDeleteArticle = async (e, article) => {
        e.stopPropagation(); // 행 클릭(펼치기)과 충돌 방지
        if (!window.confirm(`'${article.title}' 게시글을 삭제할까요? 댓글도 함께 삭제됩니다.`)) return;

        try {
            await adminDeleteArticleApi(article.id);
            setArticles(prev => prev.filter(a => a.id !== article.id));
            if (expandedArticleId === article.id) setExpandedArticleId(null);
        } catch (err) {
            console.error(err);
            alert(
                err.response?.data ||
                err.response?.data?.message ||
                "삭제에 실패했습니다."
            );
        }
    };

    const filteredArticles = useMemo(() => {
        const q = articleSearch.trim().toLowerCase();
        if (!q) return articles;
        return articles.filter(a =>
            a.title?.toLowerCase().includes(q) ||
            a.authorUsername?.toLowerCase().includes(q)
        );
    }, [articles, articleSearch]);

    const isArticlesScrollable = filteredArticles.length > 8;

    // ✅ 게시글 행 클릭 → 댓글 펼치기/접기, 처음이면 fetch
    const handleToggleArticle = async (article) => {
        if (expandedArticleId === article.id) {
            setExpandedArticleId(null);
            return;
        }
        setExpandedArticleId(article.id);

        // 이미 캐시되어 있으면 재조회 안 함
        if (articleComments[article.id]) return;

        setArticleComments(prev => ({
            ...prev,
            [article.id]: { loading: true, error: "", list: [] }
        }));

        try {
            const res = await getCommentsByArticleApi(article.id);
            setArticleComments(prev => ({
                ...prev,
                [article.id]: { loading: false, error: "", list: res.data ?? [] }
            }));
        } catch (err) {
            console.error(err);
            setArticleComments(prev => ({
                ...prev,
                [article.id]: { loading: false, error: "댓글을 불러오지 못했습니다.", list: [] }
            }));
        }
    };

    const handleDeleteComment = async (articleId, comment) => {
        if (!window.confirm("이 댓글을 삭제할까요?")) return;

        try {
            await adminDeleteCommentApi(comment.id);
            setArticleComments(prev => ({
                ...prev,
                [articleId]: {
                    ...prev[articleId],
                    list: prev[articleId].list.filter(c => c.id !== comment.id),
                }
            }));
        } catch (err) {
            console.error(err);
            alert(
                err.response?.data ||
                err.response?.data?.message ||
                "삭제에 실패했습니다."
            );
        }
    };

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

            {/* 품종 등록 / 수정 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-base font-bold text-gray-800">
                        🌱 {editingSpeciesId ? "품종 수정" : "품종 등록"}
                    </h2>
                    {editingSpeciesId && (
                        <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                            수정 중
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    {editingSpeciesId
                        ? "아래 내용을 수정하고 '수정 완료' 버튼을 눌러주세요."
                        : "여기서 등록한 품종만 사용자가 기기에 대표 품종으로 선택할 수 있어요."}
                </p>

                {speciesCreateError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{speciesCreateError}</div>
                )}
                {speciesCreateMessage && (
                    <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-2 mb-3">{speciesCreateMessage}</div>
                )}

                <form onSubmit={handleSubmitSpecies} className="flex flex-col gap-3">
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

                    <div className="flex justify-end gap-2">
                        {editingSpeciesId && (
                            <button
                                type="button"
                                onClick={resetSpeciesForm}
                                className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                취소
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={speciesCreateLoading}
                            className={`text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors ${
                                editingSpeciesId
                                    ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                                    : "bg-green-600 hover:bg-green-700 disabled:bg-green-300"
                            }`}
                        >
                            {speciesCreateLoading
                                ? (editingSpeciesId ? "수정 중..." : "등록 중...")
                                : (editingSpeciesId ? "수정 완료" : "품종 등록")}
                        </button>
                    </div>
                </form>
            </div>

            {/* 품종 목록 */}
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
                                    <tr
                                        key={s.id}
                                        className={`hover:bg-gray-50/50 ${editingSpeciesId === s.id ? "bg-blue-50/50" : ""}`}
                                    >
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
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => handleStartEditSpecies(s)}
                                                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                                                >수정</button>
                                                <button
                                                    onClick={() => handleDeleteSpecies(s.id, s.name)}
                                                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                                                >삭제</button>
                                            </div>
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

            {/* 회원 관리 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
                    <h2 className="text-base font-bold text-gray-800">👤 회원 관리</h2>
                    <span className="text-xs text-gray-400">
                        전체 {users.length}명 · 관리자 {adminCount}명
                    </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    본인 계정은 안전을 위해 여기서 탈퇴/권한 변경이 불가능해요.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex gap-2 overflow-x-auto">
                        {ROLE_FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setRoleFilter(f.key)}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                                    roleFilter === f.key
                                        ? "bg-green-600 text-white"
                                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                            >{f.label}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="아이디, 이메일 검색..."
                            className="flex-1 sm:flex-none border border-gray-200 rounded-lg px-3 py-1.5 text-xs sm:w-48 focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                        <button onClick={fetchUsers} className="text-xs text-gray-400 hover:text-green-600 px-2 py-1.5 border border-gray-200 rounded-lg whitespace-nowrap">
                            ↻ 새로고침
                        </button>
                    </div>
                </div>

                {usersListError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{usersListError}</div>
                )}

                {usersLoading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 text-sm">
                        {users.length === 0 ? "회원이 없어요" : "검색 결과가 없어요"}
                    </div>
                ) : (
                    <div className={`overflow-x-auto ${isUsersScrollable ? "max-h-[420px] overflow-y-auto" : ""}`}>
                        <table className="w-full text-sm min-w-[600px]">
                            <thead className={isUsersScrollable ? "sticky top-0 bg-white z-10" : ""}>
                                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                    <th className="py-2 pr-2 font-medium">아이디</th>
                                    <th className="py-2 pr-2 font-medium">이메일</th>
                                    <th className="py-2 pr-2 font-medium">권한</th>
                                    <th className="py-2 pr-2 font-medium">가입일</th>
                                    <th className="py-2 font-medium text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredUsers.map(u => {
                                    const isMe = u.username === myUsername;
                                    return (
                                        <tr key={u.id} className={`hover:bg-gray-50/50 ${isMe ? "bg-yellow-50/40" : ""}`}>
                                            <td className="py-3 pr-2 font-medium text-gray-700">
                                                {u.username} {isMe && <span className="text-[10px] text-yellow-600 font-bold ml-1">(나)</span>}
                                            </td>
                                            <td className="py-3 pr-2 text-gray-500">{u.email}</td>
                                            <td className="py-3 pr-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    u.role === "ROLE_ADMIN" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                                                }`}>
                                                    {u.role === "ROLE_ADMIN" ? "관리자" : "일반회원"}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-2 text-gray-400 text-xs">{u.createdAt?.slice(0, 10) || "-"}</td>
                                            <td className="py-3 text-right">
                                                <div className="flex justify-end gap-3">
                                                    <button
                                                        onClick={() => handleToggleRole(u)}
                                                        disabled={isMe || roleUpdatingId === u.id}
                                                        className={`text-xs font-medium ${
                                                            isMe
                                                                ? "text-gray-300 cursor-not-allowed"
                                                                : "text-blue-500 hover:text-blue-700"
                                                        }`}
                                                    >
                                                        {roleUpdatingId === u.id
                                                            ? "변경 중..."
                                                            : u.role === "ROLE_ADMIN" ? "일반회원으로" : "관리자로"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u)}
                                                        disabled={isMe}
                                                        className={`text-xs font-medium ${
                                                            isMe
                                                                ? "text-gray-300 cursor-not-allowed"
                                                                : "text-red-400 hover:text-red-600"
                                                        }`}
                                                    >강퇴</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredUsers.length > 0 && (
                    <p className="text-xs text-gray-300 mt-3 text-right">
                        총 {filteredUsers.length}명 {isUsersScrollable && "· 스크롤하여 더 보기"}
                    </p>
                )}
            </div>

            {/* ────────────────────────────────
                ✅ 게시글 관리 (행 클릭 → 댓글 펼치기)
            ──────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
                    <h2 className="text-base font-bold text-gray-800">📝 게시글 · 댓글 관리</h2>
                    <span className="text-xs text-gray-400">불러온 게시글 {articles.length}개</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    게시글 행을 클릭하면 해당 게시글의 댓글을 펼쳐볼 수 있어요. 삭제 버튼은 별도로 동작합니다.
                </p>

                <div className="flex items-center gap-2 mb-4">
                    <input
                        type="text"
                        value={articleSearch}
                        onChange={(e) => setArticleSearch(e.target.value)}
                        placeholder="제목, 작성자 검색..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button
                        onClick={() => fetchArticles(0)}
                        className="text-xs text-gray-400 hover:text-green-600 px-2 py-1.5 border border-gray-200 rounded-lg whitespace-nowrap"
                    >
                        ↻ 새로고침
                    </button>
                </div>

                {articlesListError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{articlesListError}</div>
                )}

                {articlesLoading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
                ) : filteredArticles.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 text-sm">
                        {articles.length === 0 ? "게시글이 없어요" : "검색 결과가 없어요"}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                    <th className="py-2 pr-2 font-medium w-4"></th>
                                    <th className="py-2 pr-2 font-medium">제목</th>
                                    <th className="py-2 pr-2 font-medium">카테고리</th>
                                    <th className="py-2 pr-2 font-medium">작성자</th>
                                    <th className="py-2 pr-2 font-medium">작성일</th>
                                    <th className="py-2 font-medium text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredArticles.map(a => {
                                    const isExpanded = expandedArticleId === a.id;
                                    const commentState = articleComments[a.id];
                                    return (
                                        <>
                                            <tr
                                                key={a.id}
                                                onClick={() => handleToggleArticle(a)}
                                                className={`cursor-pointer hover:bg-gray-50/50 ${isExpanded ? "bg-green-50/40" : ""}`}
                                            >
                                                <td className="py-3 pr-2 text-gray-300">
                                                    <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                                </td>
                                                <td className="py-3 pr-2 font-medium text-gray-700 max-w-[200px] truncate">{a.title}</td>
                                                <td className="py-3 pr-2 text-gray-500">{a.category}</td>
                                                <td className="py-3 pr-2 text-gray-500">{a.authorUsername}</td>
                                                <td className="py-3 pr-2 text-gray-400 text-xs">{a.createdAt?.slice(0, 10) || "-"}</td>
                                                <td className="py-3 text-right">
                                                    <button
                                                        onClick={(e) => handleDeleteArticle(e, a)}
                                                        className="text-xs text-red-400 hover:text-red-600 font-medium"
                                                    >삭제</button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${a.id}-comments`}>
                                                    <td colSpan={6} className="bg-gray-50/60 px-4 py-3">
                                                        {commentState?.loading ? (
                                                            <div className="text-xs text-gray-400 py-4 text-center">댓글 불러오는 중...</div>
                                                        ) : commentState?.error ? (
                                                            <div className="text-xs text-red-500 py-4 text-center">{commentState.error}</div>
                                                        ) : commentState?.list.length === 0 ? (
                                                            <div className="text-xs text-gray-300 py-4 text-center">댓글이 없어요</div>
                                                        ) : (
                                                            <div className="flex flex-col divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
                                                                {commentState?.list.map(c => (
                                                                    <div key={c.id} className="py-2.5 flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className="text-xs font-bold text-gray-700">{c.authorUsername}</span>
                                                                                <span className="text-[10px] text-gray-300">{c.createdAt?.slice(0, 10)}</span>
                                                                            </div>
                                                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.content}</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteComment(a.id, c)}
                                                                            className="text-xs text-red-400 hover:text-red-600 font-medium flex-shrink-0"
                                                                        >삭제</button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {articleHasMore && !articlesLoading && (
                    <button
                        onClick={() => fetchArticles(articlePage + 1)}
                        disabled={articlesLoadingMore}
                        className="w-full mt-3 text-xs text-gray-400 hover:text-green-600 py-2 border border-dashed border-gray-200 hover:border-green-300 rounded-lg transition-colors"
                    >
                        {articlesLoadingMore ? "불러오는 중..." : "더 불러오기"}
                    </button>
                )}

                {filteredArticles.length > 0 && (
                    <p className="text-xs text-gray-300 mt-3 text-right">
                        불러온 {filteredArticles.length}개
                    </p>
                )}
            </div>
        </div>
    );
}

export default AdminPage;