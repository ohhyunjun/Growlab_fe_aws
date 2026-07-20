import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyCommentsApi } from "../../api/commentApi";
import { getMyArticlesApi } from "../../api/articleApi";
import { updateUsernameApi, updatePasswordApi, deleteUserApi } from "../../api/authApi";

const TABS = ["프로필", "내가 쓴 글", "내가 쓴 댓글"];

function MyPage() {
    const navigate = useNavigate();

    const [username, setUsername] = useState(localStorage.getItem("username"));
    const isAdmin = localStorage.getItem("role") === "ROLE_ADMIN";

    const [activeTab, setActiveTab] = useState("프로필");
    const [isEditingName, setIsEditingName] = useState(false);
    const [newUsername, setNewUsername] = useState(username);

    const [comments, setComments] = useState([]);
    const [articles, setArticles] = useState([]);

    useEffect(() => {
        const userId = localStorage.getItem("userId");
        if (!userId) return;
        getMyCommentsApi(userId)
            .then(res => setComments(res.data))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        getMyArticlesApi()
            .then(res => setArticles(res.data.content))
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <div className="text-5xl mb-4">🌱</div>
                <h1 className="text-2xl font-bold text-gray-800 mb-1">{username}</h1>
                <p className="text-sm text-gray-400 mb-4">GrowLab 회원</p>

                {isAdmin && (
                    <button
                        onClick={() => navigate("/admin")}
                        className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                    >
                        🛠 관리자페이지로 이동
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-100">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors
                                ${activeTab === tab ? "text-green-600 border-b-2 border-green-600" : "text-gray-400 hover:text-gray-600"}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === "프로필" && (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">

                                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                                    <span className="text-sm text-gray-500">아이디</span>
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newUsername}
                                                onChange={e => setNewUsername(e.target.value)}
                                                className="border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                            />
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const token = localStorage.getItem("token");
                                                        await updateUsernameApi(newUsername, token);
                                                        alert("아이디가 변경되었습니다. 다시 로그인해주세요.");
                                                        localStorage.clear();
                                                        navigate("/login");
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert("아이디 변경 실패");
                                                    }
                                                }}
                                                className="text-xs text-green-600 font-medium hover:text-green-700"
                                            >
                                                저장
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditingName(false);
                                                    setNewUsername(username);
                                                }}
                                                className="text-xs text-gray-400 hover:text-gray-600"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-800">{username}</span>
                                            <button
                                                onClick={() => setIsEditingName(true)}
                                                className="text-xs text-gray-400 hover:text-green-600"
                                            >
                                                수정
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                                    <span className="text-sm text-gray-500">비밀번호</span>
                                    <button
                                        className="text-xs text-gray-400 hover:text-green-600"
                                        onClick={async () => {
                                            const oldPassword = prompt("현재 비밀번호 입력");
                                            const newPassword = prompt("새 비밀번호 입력");
                                            if (!oldPassword || !newPassword) return;
                                            try {
                                                const token = localStorage.getItem("token");
                                                await updatePasswordApi(oldPassword, newPassword, token);
                                                alert("비밀번호 변경 완료");
                                            } catch (e) {
                                                console.error(e);
                                                alert("비밀번호 변경 실패");
                                            }
                                        }}
                                    >
                                        변경
                                    </button>
                                </div>

                                <div className="flex justify-between items-center py-3">
                                    <span className="text-sm text-gray-500">회원 탈퇴</span>
                                    <button
                                        className="text-xs text-red-400 hover:text-red-500"
                                        onClick={async () => {
                                            const password = prompt("비밀번호 입력");
                                            if (!password) return;
                                            try {
                                                const token = localStorage.getItem("token");
                                                await deleteUserApi(password, token);
                                                localStorage.clear();
                                                alert("탈퇴 완료");
                                                navigate("/login");
                                            } catch (e) {
                                                console.error(e);
                                                alert("탈퇴 실패");
                                            }
                                        }}
                                    >
                                        탈퇴
                                    </button>
                                </div>

                            </div>
                        </div>
                    )}

                    {activeTab === "내가 쓴 글" && (
                        <div className="flex flex-col gap-3">
                            {articles.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">작성한 글이 없어요</div>
                            ) : (
                                articles.map(article => (
                                    <div key={article.id}
                                        onClick={() => navigate(`/articles/${article.id}`)}
                                        className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 hover:text-green-600">
                                                {article.title}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {article.createdAt?.slice(0, 10)} · 좋아요 {article.likesCount ?? 0}
                                            </p>
                                        </div>
                                        <span className="text-gray-300">›</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "내가 쓴 댓글" && (
                        <div className="flex flex-col gap-3">
                            {comments.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">작성한 댓글이 없어요</div>
                            ) : (
                                comments.map(comment => (
                                    <div key={comment.id} className="py-3 border-b border-gray-100 last:border-0">
                                        <p className="text-xs text-gray-400 mb-1">{comment.articleTitle || "게시글"}</p>
                                        <p className="text-sm text-gray-700">{comment.content}</p>
                                        <p className="text-xs text-gray-400 mt-1">{comment.createdAt?.slice(0, 10)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MyPage;