import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginApi } from "../../api/authApi";

function LoginPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await loginApi(form.username, form.password);
            localStorage.setItem("token", res.data.accessToken);
            localStorage.setItem("username", res.data.username);
            localStorage.setItem("userId", res.data.userId);
            localStorage.setItem("role", res.data.role);
            navigate("/");
        } catch (err) {
            setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="text-3xl mb-2">🌱</div>
                    <h1 className="text-2xl font-bold text-gray-800">GrowLab</h1>
                    <p className="text-sm text-gray-400 mt-1">스마트팜 관리 플랫폼</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && (
                        <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
                        <input
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={handleChange}
                            placeholder="아이디를 입력하세요"
                            required
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="비밀번호를 입력하세요"
                            required
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? "로그인 중..." : "로그인"}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-6">
                    계정이 없으신가요?{" "}
                    <Link to="/signup" className="text-green-600 font-medium hover:underline">
                        회원가입
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default LoginPage;