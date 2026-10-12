import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginApi } from "../../api/authApi";
import AuthLayout from "../../components/layouts/AuthLayout";
import { AuthHeading, AuthField, AuthInput, AuthPrimaryButton } from "../../components/auth/AuthUI";

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
        } catch {
            setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout>
            <AuthHeading title="반가워요!" subtitle="Grow Lab 에 오신걸 환영해요" />

            <form onSubmit={handleSubmit} className="mt-12">
                <div className="flex flex-col gap-7">
                    <AuthField label="아이디" htmlFor="username">
                        <AuthInput
                            id="username"
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={handleChange}
                            placeholder="아이디를 입력하세요"
                            autoComplete="username"
                            required
                        />
                    </AuthField>
                    <AuthField label="비밀번호" htmlFor="password">
                        <AuthInput
                            id="password"
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="비밀번호를 입력하세요"
                            autoComplete="current-password"
                            required
                        />
                    </AuthField>
                </div>

                {error && (
                    <p role="alert" className="mt-4 text-body2 text-red-600">{error}</p>
                )}

                <AuthPrimaryButton type="submit" disabled={loading} className="mt-9">
                    {loading ? "로그인 중..." : "로그인"}
                </AuthPrimaryButton>
            </form>

            {/* 링크 박스 112px 고정, 구분선 좌우 32px */}
            <div className="mt-16 flex items-center justify-center gap-8 text-sub1 text-gray-400">
                <Link to="/find-id" className="w-28 text-center hover:text-gray-600">아이디 찾기</Link>
                <span className="w-px h-8 -mr-px bg-gray-300" aria-hidden="true" />
                <Link to="/forgot-password" className="w-28 text-center hover:text-gray-600">비밀번호 찾기</Link>
            </div>

            <div className="mt-9 h-[68px] rounded bg-white flex items-center justify-center gap-5 text-sub1">
                <span className="text-gray-400">계정이 없으신가요?</span>
                <Link to="/signup" className="font-medium text-brand hover:underline">회원가입</Link>
            </div>
        </AuthLayout>
    );
}

export default LoginPage;
