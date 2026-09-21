import { useState } from "react";
import { Link } from "react-router-dom";
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
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="text-3xl mb-2">🔍</div>
                    <h1 className="text-2xl font-bold text-gray-800">아이디 찾기</h1>
                    <p className="text-sm text-gray-400 mt-1">가입한 이메일로 본인 확인 후 아이디를 알려드려요</p>
                </div>

                {maskedUsername ? (
                    <div className="flex flex-col gap-4">
                        <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                            <p className="text-xs text-gray-400 mb-2">회원님의 아이디는</p>
                            <p className="text-2xl font-bold text-green-700 tracking-wide">{maskedUsername}</p>
                            <p className="text-xs text-gray-400 mt-2">보안을 위해 일부만 표시돼요</p>
                        </div>
                        <Link
                            to="/login"
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors text-center"
                        >
                            로그인하러 가기
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {error && (
                            <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2">{error}</div>
                        )}
                        {message && !error && (
                            <div className={`text-xs rounded-lg px-3 py-2 ${
                                emailVerified ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-500"
                            }`}>
                                {emailVerified ? "✓ " : ""}{message}
                            </div>
                        )}

                        {/* 이메일 + 인증코드 받기 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">가입한 이메일</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={handleEmailChange}
                                    placeholder="이메일을 입력하세요"
                                    required
                                    disabled={emailVerified}
                                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-400"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={sendLoading || emailVerified || !email.trim()}
                                    className="flex-shrink-0 px-4 py-2.5 text-xs font-medium rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors whitespace-nowrap"
                                >
                                    {emailVerified
                                        ? "인증완료"
                                        : sendLoading
                                            ? "발송 중..."
                                            : codeSent ? "재발송" : "인증코드 받기"}
                                </button>
                            </div>
                        </div>

                        {/* 인증코드 입력 */}
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
                                        disabled={verifyLoading || findLoading || !code.trim()}
                                        className="flex-shrink-0 px-4 py-2.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white transition-colors whitespace-nowrap"
                                    >
                                        {verifyLoading || findLoading ? "확인 중..." : "인증확인"}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">5분 이내에 입력해야 해요.</p>
                            </div>
                        )}
                    </div>
                )}

                <p className="text-center text-sm text-gray-400 mt-6">
                    <Link to="/login" className="text-green-600 font-medium hover:underline">
                        로그인으로 돌아가기
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default FindIdPage;