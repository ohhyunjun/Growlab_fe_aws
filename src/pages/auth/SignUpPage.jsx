import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupApi, sendEmailCodeApi, verifyEmailCodeApi } from "../../api/authApi";
import AuthLayout from "../../components/layouts/AuthLayout";
import { AuthField, AuthInput, AuthInputRow, AuthActionButton, AuthPrimaryButton, StatusChip } from "../../components/auth/AuthUI";
import iconBack from "../../assets/icon-back.svg";

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
    const [, setEmailMessage] = useState("");

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

    // 시도 횟수 초과 여부 (handleVerifyCode의 코드 초기화 조건과 동일)
    const codeLocked = emailError.includes("초과") || emailError.includes("다시 받아주세요");

    return (
        <AuthLayout wide top={80}>
            {/* 제목: PC/H1/Bold, 뒤로가기 아이콘 32 + 간격 16 */}
            <div className="flex items-center gap-4 lg:-ml-12">
                <Link to="/login" aria-label="로그인으로 돌아가기" className="shrink-0">
                    <img src={iconBack} alt="" width="32" height="32" />
                </Link>
                <h1 className="text-h2 font-bold text-gray-950">회원가입</h1>
            </div>
            <p className="mt-1 text-h4 font-normal text-gray-600">Grow Lab 과 함께 스마트팜을 시작해보세요!</p>

            <form onSubmit={handleSubmit} className="mt-8">
                <div className="flex flex-col gap-5">
                    <AuthField size="md" label="아이디" htmlFor="username" hint="4~20자 이내로 입력해주세요">
                        <AuthInput
                            size="md"
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

                    <AuthField
                        size="md"
                        label="이메일"
                        htmlFor="email"
                        hint="‘@’ 을 포함해 입력해주세요"
                        error={!codeSent ? emailError : ""}
                    >
                        <AuthInputRow>
                            <AuthInput
                                size="md"
                                id="email"
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="이메일을 입력하세요"
                                autoComplete="email"
                                required
                                disabled={emailVerified}
                            />
                            <AuthActionButton
                                size="md"
                                onClick={handleSendCode}
                                disabled={!form.email.trim() || sendLoading || emailVerified}
                            >
                                {sendLoading ? "발송 중..." : codeSent ? "재발송 하기" : "인증번호 받기"}
                            </AuthActionButton>
                        </AuthInputRow>
                    </AuthField>

                    {/* 인증번호 - 발송 후 노출 (인증 완료 후에도 결과 표시) */}
                    {codeSent && (
                        <AuthField
                            size="md"
                            label="인증번호"
                            htmlFor="code"
                            hint="인증번호가 발송되었습니다. 메일함 (스팸함 포함) 을 확인해주세요. 5분 이내에 입력해 주세요."
                            status={
                                emailVerified ? (
                                    <StatusChip type="success" className="lg:w-[calc(100%-220px)]">인증이 완료되었습니다.</StatusChip>
                                ) : emailError ? (
                                    codeLocked ? (
                                        <StatusChip type="error" full>{emailError}</StatusChip>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <StatusChip type="error">{emailError}</StatusChip>
                                            <span className="text-body1 text-gray-400">메일함(스팸) 을 확인해주세요. 5분 이내에 입력해 주세요.</span>
                                        </div>
                                    )
                                ) : null
                            }
                        >
                            <AuthInputRow>
                                <AuthInput
                                    size="md"
                                    id="code"
                                    type="text"
                                    inputMode="numeric"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="6자리 숫자를 입력하세요"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    disabled={emailVerified}
                                />
                                <AuthActionButton
                                    size="md"
                                    done={emailVerified}
                                    onClick={handleVerifyCode}
                                    disabled={emailVerified || verifyLoading || !code.trim()}
                                >
                                    {emailVerified ? "인증 완료" : verifyLoading ? "확인 중..." : "인증 확인"}
                                </AuthActionButton>
                            </AuthInputRow>
                        </AuthField>
                    )}

                    <AuthField size="md" label="비밀번호" htmlFor="password" hint="8~20자 이내로 입력해주세요">
                        <AuthInput
                            size="md"
                            id="password"
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="비밀번호를 입력하세요"
                            autoComplete="new-password"
                            required
                        />
                    </AuthField>

                    <AuthField size="md" label="비밀번호 확인" htmlFor="confirmPassword">
                        <AuthInput
                            size="md"
                            id="confirmPassword"
                            type="password"
                            name="confirmPassword"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            placeholder="비밀번호를 다시 입력하세요"
                            autoComplete="new-password"
                            required
                        />
                    </AuthField>
                </div>

                {error && <StatusChip type="error" full className="mt-5">{error}</StatusChip>}

                {/* Figma: 인증번호 칸이 생기면 1080 안에 맞추려고 간격을 좁힘 (44→32, 40→20) */}
                <AuthPrimaryButton size="md" type="submit" disabled={loading || !emailVerified} className={codeSent ? "mt-8" : "mt-11"}>
                    {loading ? "가입 중..." : "회원가입 하기"}
                </AuthPrimaryButton>
            </form>

            <div className={`${codeSent ? "mt-5" : "mt-10"} flex items-center justify-center gap-3 text-sub1 font-medium`}>
                <span className="text-gray-400">이미 계정이 있으신가요?</span>
                <Link to="/login" className="w-20 text-brand hover:underline">로그인</Link>
            </div>
        </AuthLayout>
    );
}

export default SignUpPage;
