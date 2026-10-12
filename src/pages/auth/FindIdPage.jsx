import { useState } from "react";
import AuthLayout from "../../components/layouts/AuthLayout";
import { AuthHeading, AuthField, AuthInput, AuthInputRow, AuthActionButton, AuthBoxLink } from "../../components/auth/AuthUI";
import { sendFindIdCodeApi, verifyEmailCodeApi, findIdApi } from "../../api/authApi";

function FindIdPage() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");

    const [codeSent, setCodeSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [maskedUsername, setMaskedUsername] = useState(null);

    const [sendLoading, setSendLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [findLoading, setFindLoading] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
        setEmailVerified(false);
        setCodeSent(false);
        setCode("");
        setMaskedUsername(null);
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
            const res = await sendFindIdCodeApi(email.trim());
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

            // 인증 완료 즉시 아이디 조회
            setFindLoading(true);
            try {
                const findRes = await findIdApi(email.trim());
                setMaskedUsername(findRes.data.maskedUsername);
            } catch (findErr) {
                setError(
                    findErr.response?.data ||
                    findErr.response?.data?.message ||
                    "아이디 조회에 실패했습니다."
                );
            } finally {
                setFindLoading(false);
            }
        } catch (err) {
            const msg =
                err.response?.data ||
                err.response?.data?.message ||
                "인증코드 확인에 실패했습니다.";
            setError(msg);
            if (msg.includes("초과") || msg.includes("다시 받아주세요")) {
                setCode("");
            }
        } finally {
            setVerifyLoading(false);
        }
    };

    return (
        <AuthLayout wide>
            <AuthHeading title="아이디 찾기" subtitle="가입하신 이메일로 본인 확인 후 아이디를 알려드려요" />

            {maskedUsername ? (
                <div className="mt-12 flex flex-col gap-9">
                    <div className="rounded bg-white px-8 py-10 text-center">
                        <p className="text-sub1 font-medium text-gray-600">회원님의 아이디는</p>
                        <p className="mt-2 text-h2 font-bold text-brand">{maskedUsername}</p>
                        <p className="mt-2 text-body2 text-gray-500">보안을 위해 일부만 표시돼요</p>
                    </div>
                    <AuthBoxLink to="/login" variant="primary">로그인하러 가기</AuthBoxLink>
                </div>
            ) : (
                <div className="mt-12 flex flex-col gap-7">
                    <AuthField
                        label="가입한 이메일"
                        htmlFor="email"
                        error={!codeSent || emailVerified ? error : ""}
                        hint={!codeSent && message}
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
                                    disabled={!code.trim() || verifyLoading || findLoading}
                                >
                                    {verifyLoading || findLoading ? "확인 중..." : "인증확인"}
                                </AuthActionButton>
                            </AuthInputRow>
                        </AuthField>
                    )}
                </div>
            )}

            {!maskedUsername && <AuthBoxLink to="/login" className="mt-9">로그인으로 돌아가기</AuthBoxLink>}
        </AuthLayout>
    );
}

export default FindIdPage;