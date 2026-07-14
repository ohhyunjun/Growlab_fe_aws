import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    getAllDevicesAdminApi,
    adminCreateDeviceApi,
    adminDeleteDeviceApi,
} from "../../api/deviceApi";

const FILTERS = [
    { key: "all", label: "전체" },
    { key: "unregistered", label: "미배정" },
    { key: "registered", label: "배정됨" },
];

function AdminPage() {
    const navigate = useNavigate();

    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState("");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    // 등록 폼
    const [serial, setSerial] = useState("");
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createMessage, setCreateMessage] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        if (!token || role !== "ROLE_ADMIN") {
            navigate("/");
            return;
        }
        fetchDevices();
    }, [navigate]);

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
                d.ownerUsername?.toLowerCase().includes(q);

            return matchesFilter && matchesSearch;
        });
    }, [devices, search, filter]);

    const registeredCount = devices.filter(d => d.registered).length;
    const unregisteredCount = devices.length - registeredCount;

    // ✅ 목록이 길어지면 세로 스크롤로 전환 (8개 초과 기준)
    const isScrollable = filtered.length > 8;

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
                    // ✅ 가로 스크롤(모바일 대응) + 세로 스크롤(목록 길어질 때) 동시 지원
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
        </div>
    );
}

export default AdminPage;