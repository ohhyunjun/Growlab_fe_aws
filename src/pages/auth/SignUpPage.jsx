import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupApi, sendEmailCodeApi, verifyEmailCodeApi } from "../../api/authApi";

function SignUpPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // ✅ 이메일 인증 관련 상태
    const [code, setCode] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [sendLoading, setSendLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [emailMessage, setEmailMessage] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));

        // ✅ 이메일을 다시 바꾸면 인증 상태 초기화
        if (name === "email") {
            setEmailVerified(false);
            setCodeSent(false);
            setCode("");
            setEmailError("");
            setEmailMessage("");
        }
    };

    const handleSendCode = async () => {
        if (!form.email.trim()) {
            setEmailError("이메일을 먼저 입력해주세요.");
            return;
        }
        setSendLoading(true);
        setEmailError("");
        setEmailMessage("");
        try {
            const res = await sendEmailCodeApi(form.email.trim());
            setEmailMessage(res.data || "인증코드가 발송되었습니다. 메일함을 확인해주세요.");
            setCodeSent(true);
        } catch (err) {
            setEmailError(
                err.response?.data ||
                err.response?.data?.message ||
                "인증코드 발송에 실패했습니다."
            );
        } finally {
            setSendLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!code.trim()) {
            setEmailError("인증코드를 입력해주세요.");
            return;
        }
        setVerifyLoading(true);
        setEmailError("");
        setEmailMessage("");
        try {
            const res = await verifyEmailCodeApi(form.email.trim(), code.trim());
            setEmailMessage(res.data || "이메일 인증이 완료되었습니다.");
            setEmailVerified(true);
        } catch (err) {
            const msg =
                err.response?.data ||
                err.response?.data?.message ||
                "인증코드 확인에 실패했습니다.";
            setEmailError(msg);
            // ✅ 시도 횟수 초과 메시지면 입력창을 비우고 재발송을 유도
            if (msg.includes("초과") || msg.includes("다시 받아주세요")) {
                setCode("");
            }
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!emailVerified) {
            setError("이메일 인증을 먼저 완료해주세요.");
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }

        setLoading(true);
        try {
            await signupApi(form.username, form.email, form.password);
            navigate("/login");
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data || "회원가입 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
                {/* 로고 */}
                <div className="text-center mb-8">
                    <div className="text-3xl mb-2">🌱</div>
                    <h1 className="text-2xl font-bold text-gray-800">GrowLab 회원가입</h1>
                    <p className="text-sm text-gray-400 mt-1">스마트팜을 시작해보세요</p>
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
                        <p className="text-xs text-gray-400 mt-1">4~20자 이내</p>
                    </div>

                    {/* ✅ 이메일 + 인증코드 받기 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="이메일을 입력하세요"
                                required
                                disabled={emailVerified}
                                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={handleSendCode}
                                disabled={sendLoading || emailVerified || !form.email.trim()}
                                className="flex-shrink-0 px-4 py-2.5 text-xs font-medium rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors whitespace-nowrap"
                            >
                                {emailVerified
                                    ? "인증완료"
                                    : sendLoading
                                        ? "발송 중..."
                                        : codeSent ? "재발송" : "인증코드 받기"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">'@' 포함 필수입력</p>
                    </div>

                    {/* ✅ 인증코드 입력 - 발송했고 아직 인증 안 됐을 때만 노출 */}
                    {codeSent && !emailVerified && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">인증코드</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="6자리 숫자를 입력하세요"
                                    maxLength={6}
                                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                />
                                <button
                                    type="button"
                                    onClick={handleVerifyCode}
                                    disabled={verifyLoading || !code.trim()}
                                    className="flex-shrink-0 px-4 py-2.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white transition-colors whitespace-nowrap"
                                >
                                    {verifyLoading ? "확인 중..." : "인증확인"}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">메일함(스팸함 포함)을 확인해주세요. 5분 이내에 입력해야 해요.</p>
                        </div>
                    )}

                    {emailError && (
                        <div className="bg-red-50 text-red-500 text-xs rounded-lg px-3 py-2 -mt-2">{emailError}</div>
                    )}
                    {emailMessage && !emailError && (
                        <div className={`text-xs rounded-lg px-3 py-2 -mt-2 ${
                            emailVerified ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-500"
                        }`}>
                            {emailVerified ? "✓ " : ""}{emailMessage}
                        </div>
                    )}

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
                        <p className="text-xs text-gray-400 mt-1">8~20자 이내</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            placeholder="비밀번호를 다시 입력하세요"
                            required
                            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !emailVerified}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? "가입 중..." : !emailVerified ? "이메일 인증을 완료해주세요" : "회원가입"}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-6">
                    이미 계정이 있으신가요?{" "}
                    <Link to="/login" className="text-green-600 font-medium hover:underline">
                        로그인
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default SignUpPage;
