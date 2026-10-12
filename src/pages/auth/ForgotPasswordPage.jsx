import { useState } from "react";
import AuthLayout from "../../components/layouts/AuthLayout";
import { AuthHeading, AuthField, AuthInput, AuthInputRow, AuthActionButton, AuthPrimaryButton, AuthBoxLink } from "../../components/auth/AuthUI";
import { sendPasswordResetCodeApi, verifyEmailCodeApi, resetPasswordApi } from "../../api/authApi";

function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [codeSent, setCodeSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [done, setDone] = useState(false);

    const [sendLoading, setSendLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
        setEmailVerified(false);
        setCodeSent(false);
        setCode("");
        setError("");
        setMessage("");
    };

    const handleSendCode = async () => {
        if (!email.trim()) {
            setError("이메일을 입력해주세요.");
            return;
        }
        setSendLoading(true);
        setError("");
        setMessage("");
        try {
            const res = await sendPasswordResetCodeApi(email.trim());
            setMessage(res.data || "인증코드가 발송되었습니다. 메일함을 확인해주세요.");
            setCodeSent(true);
        } catch (err) {
            setError(
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
            setError("인증코드를 입력해주세요.");
            return;
        }
        setVerifyLoading(true);
        setError("");
        setMessage("");
        try {
            const res = await verifyEmailCodeApi(email.trim(), code.trim());
            setMessage(res.data || "이메일 인증이 완료되었습니다.");
            setEmailVerified(true);
        } catch (err) {
            const msg =
                err.response?.data ||
                err.response?.data?.message ||
                "인증코드 확인에 실패했습니다.";
            setError(msg);
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
        if (newPassword !== confirmPassword) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }

        setResetLoading(true);
        try {
            await resetPasswordApi(email.trim(), newPassword);
            setDone(true);
        } catch (err) {
            setError(
                err.response?.data ||
                err.response?.data?.message ||
                "비밀번호 재설정에 실패했습니다."
            );
        } finally {
            setResetLoading(false);
        }
    };

    if (done) {
        return (
            <AuthLayout wide>
                <AuthHeading title="비밀번호가 재설정되었어요" subtitle="새 비밀번호로 다시 로그인해주세요" />
                <AuthBoxLink to="/login" variant="primary" className="mt-12">로그인하러 가기</AuthBoxLink>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout wide>
            <AuthHeading title="비밀번호 찾기" subtitle="가입하신 이메일로 본인 확인 후 비밀번호를 재설정해요" />

            <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-7">
                <AuthField
                    label="가입한 이메일"
                    htmlFor="email"
                    error={!codeSent && !emailVerified ? error : ""}
                    hint={emailVerified ? "✓ 이메일 인증이 완료되었어요" : !codeSent && message}
                >
                    <AuthInputRow>
                        <AuthInput
                            id="email"
                            type="email"
                            value={email}
                            onChange={handleEmailChange}
                            placeholder="이메일을 입력하세요"
                            autoComplete="email"
                            disabled={emailVerified}
                        />
                        <AuthActionButton
                            onClick={handleSendCode}
                            disabled={!email.trim() || sendLoading || emailVerified}
                        >
                            {emailVerified ? "인증완료" : sendLoading ? "발송 중..." : codeSent ? "재발송" : "인증번호 받기"}
                        </AuthActionButton>
                    </AuthInputRow>
                </AuthField>

                {codeSent && !emailVerified && (
                    <AuthField
                        label="인증번호"
                        htmlFor="code"
                        error={error}
                        hint={message || "5분 이내에 입력해야 해요."}
                    >
                        <AuthInputRow>
                            <AuthInput
                                id="code"
                                type="text"
                                inputMode="numeric"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="6자리 숫자를 입력하세요"
                                maxLength={6}
                                autoComplete="one-time-code"
                            />
                            <AuthActionButton
                                onClick={handleVerifyCode}
                                disabled={!code.trim() || verifyLoading}
                            >
                                {verifyLoading ? "확인 중..." : "인증확인"}
                            </AuthActionButton>
                        </AuthInputRow>
                    </AuthField>
                )}

                {/* 이메일 인증 완료 후에만 새 비밀번호 입력 노출 */}
                {emailVerified && (
                    <>
                        <AuthField label="새 비밀번호" htmlFor="newPassword" hint="8~20자 이내">
                            <AuthInput
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="새 비밀번호를 입력하세요"
                                autoComplete="new-password"
                                required
                            />
                        </AuthField>
                        <AuthField label="새 비밀번호 확인" htmlFor="confirmPassword" error={error}>
                            <AuthInput
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="새 비밀번호를 다시 입력하세요"
                                autoComplete="new-password"
                                required
                            />
                        </AuthField>
                        <AuthPrimaryButton type="submit" disabled={resetLoading} className="mt-2">
                            {resetLoading ? "재설정 중..." : "비밀번호 재설정"}
                        </AuthPrimaryButton>
                    </>
                )}
            </form>

            <AuthBoxLink to="/login" className="mt-9">로그인으로 돌아가기</AuthBoxLink>
        </AuthLayout>
    );
}

export default ForgotPasswordPage;