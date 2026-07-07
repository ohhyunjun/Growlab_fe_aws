import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupApi } from "../../api/authApi";
import greenhouseBg from "../../assets/background.png";

function SignUpPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const getSignupErrorMessage = (err) => {
        const data = err.response?.data;
        if (typeof data === "string") return data;
        if (data?.message) return data.message;
        if (data?.detail) return data.detail;
        if (data?.errors && typeof data.errors === "object") {
            return Object.values(data.errors).flat().join("\n");
        }
        if (data && typeof data === "object") {
            return Object.values(data)
                .filter(value => typeof value === "string")
                .join("\n") || "입력값을 다시 확인해주세요.";
        }
        return "회원가입 중 오류가 발생했습니다.";
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (form.password !== form.confirmPassword) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (form.username.length < 4 || form.username.length > 20) {
            setError("아이디는 4자에서 20자까지 입력해주세요.");
            return;
        }
        if (form.password.length < 8 || form.password.length > 20) {
            setError("비밀번호는 8자에서 20자까지 입력해주세요.");
            return;
        }

        setLoading(true);
        try {
            await signupApi(form.username, form.email, form.password);
            navigate("/login");
        } catch (err) {
            setError(getSignupErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
    <div className="relative w-full min-h-screen overflow-hidden flex items-center justify-center">

        {/* 배경 */}
        <div
            className="absolute inset-0 w-full h-full"
            style={{
                backgroundImage: `url(${greenhouseBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: "blur(4px)",
            }}
        />

        {/* 밝은 오버레이 */}
        <div className="absolute inset-0 bg-white/20" />

        {/* 회원가입 카드 */}
        <div className="relative z-10 bg-white/88 backdrop-blur-md rounded-2xl border border-white/70 shadow-2xl w-full max-w-md p-8">

            {/* 로고 */}
            <div className="text-center mb-8">
                <div className="text-3xl mb-2">🌱</div>

                <h1 className="text-2xl font-bold text-gray-800">
                    GrowLab 회원가입
                </h1>

                <p className="text-sm text-gray-400 mt-1">
                    스마트팜을 시작해보세요
                </p>
            </div>

            {/* 회원가입 폼 */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                {error && (
                    <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        아이디
                    </label>

                    <input
                        type="text"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        placeholder="아이디를 입력하세요"
                        required
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />

                    <p className="text-xs text-gray-400 mt-1">
                        4~20자 이내
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        이메일
                    </label>

                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="이메일을 입력하세요"
                        required
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />

                    <p className="text-xs text-gray-400 mt-1">
                        '@' 포함 필수입력
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        비밀번호
                    </label>

                    <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="비밀번호를 입력하세요"
                        required
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />

                    <p className="text-xs text-gray-400 mt-1">
                        8~20자 이내
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        비밀번호 확인
                    </label>

                    <input
                        type="password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="비밀번호를 다시 입력하세요"
                        required
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                    {loading ? "가입 중..." : "회원가입"}
                </button>
            </form>

                <p className="text-center text-sm text-gray-400 mt-6">
                    이미 계정이 있으신가요?{" "}
                    <Link
                        to="/login"
                        className="text-green-600 font-medium hover:underline"
                    >
                        로그인
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default SignUpPage;
