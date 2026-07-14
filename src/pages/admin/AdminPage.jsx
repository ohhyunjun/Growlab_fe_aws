import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminCreateDeviceApi, adminDeleteDeviceApi } from "../../api/deviceApi";

const SESSION_KEY = "admin_registered_serials";

function AdminPage() {
    const navigate = useNavigate();

    const [serial, setSerial] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [sessionLog, setSessionLog] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
        } catch {
            return [];
        }
    });

    const [deleteSerial, setDeleteSerial] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        if (!token || role !== "ROLE_ADMIN") {
            navigate("/");
        }
    }, [navigate]);

    const saveSessionLog = (log) => {
        setSessionLog(log);
        localStorage.setItem(SESSION_KEY, JSON.stringify(log));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const trimmed = serial.trim().toUpperCase();
        if (!trimmed) {
            setError("시리얼 번호를 입력해주세요.");
            return;
        }

        setLoading(true);
        setError("");
        setMessage("");
        try {
            const res = await adminCreateDeviceApi(trimmed);
            setMessage(res.data || `${trimmed} 등록 완료!`);
            setSerial("");
            saveSessionLog([
                { serial: trimmed, action: "등록", at: new Date().toLocaleString("ko-KR") },
                ...sessionLog,
            ]);
        } catch (err) {
            setError(
                err.response?.data ||
                err.response?.data?.message ||
                "시리얼 등록에 실패했습니다. 이미 등록된 번호일 수 있어요."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        const trimmed = deleteSerial.trim().toUpperCase();
        if (!trimmed) {
            setDeleteError("삭제할 시리얼 번호를 입력해주세요.");
            return;
        }
        if (!window.confirm(`${trimmed} 기기를 완전히 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

        setDeleteLoading(true);
        setDeleteError("");
        try {
            await adminDeleteDeviceApi(trimmed);
            setDeleteSerial("");
            saveSessionLog([
                { serial: trimmed, action: "삭제", at: new Date().toLocaleString("ko-KR") },
                ...sessionLog,
            ]);
        } catch (err) {
            setDeleteError(
                err.response?.data ||
                err.response?.data?.message ||
                "삭제에 실패했습니다. 존재하지 않는 시리얼일 수 있어요."
            );
        } finally {
            setDeleteLoading(false);
        }
    };

    const clearLog = () => {
        if (!window.confirm("이번 세션 등록/삭제 이력을 초기화할까요? (실제 서버 데이터는 지워지지 않습니다)")) return;
        saveSessionLog([]);
    };

    return (
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate("/mypage")} className="text-gray-400 hover:text-gray-600 text-sm">← 마이페이지</button>
                    <h1 className="text-xl font-bold text-gray-800">🛠 관리자페이지</h1>
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full">ADMIN</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-bold text-gray-800 mb-1">기기 시리얼 번호 등록</h2>
                <p className="text-xs text-gray-400 mb-4">
                    여기서 등록한 시리얼 번호만 사용자가 홈 화면에서 "+ 기기 추가"로 자신의 기기로 등록할 수 있어요.
                </p>

                {error && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{error}</div>
                )}
                {message && (
                    <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-2 mb-3">{message}</div>
                )}

                <form onSubmit={handleCreate} className="flex gap-2">
                    <input
                        type="text"
                        value={serial}
                        onChange={(e) => setSerial(e.target.value)}
                        placeholder="예: GROWLAB-A001"
                        className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                        {loading ? "등록 중..." : "등록"}
                    </button>
                </form>
                <p className="text-xs text-gray-400 mt-2">
                    * 사용자가 홈에서 기기를 추가할 때 입력하는 시리얼 번호와 형식이 동일해야 합니다 (예: GROWLAB- 접두사 포함 여부 확인).
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-bold text-gray-800 mb-1">기기 완전 삭제</h2>
                <p className="text-xs text-gray-400 mb-4">
                    소유자와 상관없이 해당 시리얼의 기기 데이터를 완전히 삭제합니다. 신중하게 사용해주세요.
                </p>

                {deleteError && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2 mb-3">{deleteError}</div>
                )}

                <form onSubmit={handleDelete} className="flex gap-2">
                    <input
                        type="text"
                        value={deleteSerial}
                        onChange={(e) => setDeleteSerial(e.target.value)}
                        placeholder="예: GROWLAB-A001"
                        className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <button
                        type="submit"
                        disabled={deleteLoading}
                        className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                        {deleteLoading ? "삭제 중..." : "완전 삭제"}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-800">이번 세션 처리 이력</h2>
                    {sessionLog.length > 0 && (
                        <button onClick={clearLog} className="text-xs text-gray-400 hover:text-red-500">이력 지우기</button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mb-3">
                    ⚠️ 서버에 전체 시리얼 목록 조회 API가 아직 없어서, 브라우저에 임시로 남긴 기록입니다. 새로고침해도 유지되지만 다른 기기/브라우저에서는 보이지 않아요.
                </p>
                {sessionLog.length === 0 ? (
                    <div className="text-center py-8 text-gray-300 text-sm">아직 처리 이력이 없어요</div>
                ) : (
                    <div className="flex flex-col divide-y divide-gray-50">
                        {sessionLog.map((log, i) => (
                            <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        log.action === "등록" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                                    }`}>{log.action}</span>
                                    <span className="font-medium text-gray-700">{log.serial}</span>
                                </div>
                                <span className="text-xs text-gray-400">{log.at}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminPage;