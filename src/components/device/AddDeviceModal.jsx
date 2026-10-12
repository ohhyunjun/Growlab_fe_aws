import { useState } from "react";
import { registerDeviceApi } from "../../api/deviceApi";

const ICONS = ["🍓", "🌿", "🌱", "🌻", "🍅", "🥬", "🌶️", "🌸"];
const LOCATIONS = ["거실", "베란다", "주방", "침실", "서재", "기타"];
const STEPS = ["기기 정보", "연결 확인", "완료"];

function AddDeviceModal({ onClose, onSuccess }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ serial: "", nickname: "", icon: 0, location: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState([]);

    const handleSubmit = async () => {
        if (loading) return;
        if (!form.serial || !form.nickname) {
            setError("시리얼 번호와 기기 이름을 입력해주세요.");
            return;
        }
        setError("");
        setStep(2);
        setLoading(true);

        const statuses = [
            { text: "기기 신호 탐색 완료", done: true },
            { text: "서버 연결 확인 중...", done: false },
            { text: "기기 상태 점검 중...", done: false },
            { text: "계정과 연동 중...", done: false },
        ];

        for (let i = 0; i < statuses.length; i++) {
            await new Promise(r => setTimeout(r, 700));
            setConnectionStatus(prev => [...prev, statuses[i]]);
        }

        try {
            await registerDeviceApi(`GROWLAB-${form.serial}`, form.nickname);
            const iconKey = `device_icon_GROWLAB-${form.serial}`;
            localStorage.setItem(iconKey, String(form.icon));
            console.log("아이콘 저장:", iconKey, "->", form.icon);
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data || "기기 등록에 실패했습니다.");
            setStep(1);
            setConnectionStatus([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-col-4 p-6 relative shadow-xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-600 text-sub1">✕</button>
                <h2 className="text-sub1 font-bold text-gray-800 mb-5">🌱 기기 추가</h2>

                <div className="flex items-center mb-6">
                    {STEPS.map((label, i) => (
                        <div key={i} className="flex items-center flex-1 last:flex-none">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-caption font-bold
                                    ${step > i + 1 ? "bg-brand text-white" : step === i + 1 ? "bg-brand text-white" : "bg-gray-200 text-gray-500"}`}>
                                    {step > i + 1 ? "✓" : i + 1}
                                </div>
                                <span className={`text-caption ${step === i + 1 ? "text-brand font-medium" : "text-gray-500"}`}>{label}</span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`flex-1 h-px mx-2 ${step > i + 1 ? "bg-brand" : "bg-gray-200"}`} />
                            )}
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <div className="flex flex-col gap-4">
                        {error && <div className="bg-red-50 text-red-600 text-body2 rounded-lg px-4 py-2">{error}</div>}
                        <div>
                            <label className="block text-body2 font-medium text-gray-700 mb-1">시리얼 번호 <span className="text-red-600">*</span></label>
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-leaf">
                                <span className="bg-gray-50 px-3 py-3 text-body2 text-gray-500 border-r border-gray-200">GROWLAB-</span>
                                <input
                                    type="text"
                                    value={form.serial}
                                    onChange={e => setForm({ ...form, serial: e.target.value.toUpperCase() })}
                                    placeholder="예: A001"
                                    maxLength={5}
                                    className="flex-1 px-3 py-3 text-body2 focus:outline-none"
                                />
                            </div>
                            <p className="text-caption text-gray-500 mt-1">기기 패키지 스티커 또는 박스에서 확인 (영문 1자리 + 숫자 3자리)</p>
                        </div>
                        <div>
                            <label className="block text-body2 font-medium text-gray-700 mb-1">기기 이름 <span className="text-red-600">*</span></label>
                            <input
                                type="text"
                                value={form.nickname}
                                onChange={e => setForm({ ...form, nickname: e.target.value })}
                                placeholder="예: 거실 스마트팜"
                                maxLength={20}
                                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf"
                            />
                            <p className="text-caption text-gray-500 mt-1">최대 20자 이내</p>
                        </div>
                        <div>
                            <label className="block text-body2 font-medium text-gray-700 mb-2">기기 아이콘</label>
                            <div className="flex gap-2">
                                {ICONS.map((icon, i) => (
                                    <button key={i} onClick={() => setForm({ ...form, icon: i })}
                                        className={`w-9 h-9 rounded-lg text-sub1 flex items-center justify-center border-2 transition-colors
                                            ${form.icon === i ? "border-brand bg-brand-cream" : "border-gray-200 hover:border-gray-300"}`}
                                    >{icon}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-body2 font-medium text-gray-700 mb-1">설치 위치</label>
                            <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf text-gray-500">
                                <option value="">위치를 선택하세요 (선택사항)</option>
                                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>
                        <button onClick={handleSubmit}
                            className="w-full bg-brand hover:bg-brand-deep text-white font-medium py-3 rounded-lg text-body2 transition-colors mt-2">
                            연결 확인
                        </button>
                        <button onClick={onClose} className="w-full text-gray-500 text-body2 py-1 hover:text-gray-600">취소</button>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex flex-col items-center py-4">
                        <div className="w-16 h-16 rounded-full bg-brand-cream flex items-center justify-center text-h2 mb-6">
                            {ICONS[form.icon]}
                        </div>
                        <div className="w-full flex flex-col gap-3">
                            {connectionStatus.map((s, i) => (
                                <div key={i} className={`flex items-center gap-2 text-body2 px-3 py-2 rounded-lg ${s.done ? "bg-brand-cream" : "bg-amber-50"}`}>
                                    <span className={s.done ? "text-brand" : "text-amber-700"}>{s.done ? "✓" : "⏳"}</span>
                                    <span className={s.done ? "text-gray-700" : "text-gray-500"}>{s.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="flex flex-col items-center py-4 gap-4">
                        <div className="w-16 h-16 rounded-full bg-brand-cream flex items-center justify-center">
                            <span className="text-brand text-h2">✓</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-sub1 font-bold text-gray-800 mb-1">기기 등록 완료!</h3>
                            <p className="text-body2 text-gray-500">스마트팜 기기가 성공적으로 연결되었습니다.</p>
                            <p className="text-body2 text-gray-500">이제 식물을 등록하고 재배를 시작해보세요.</p>
                        </div>
                        <div className="w-full bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                            <span className="text-h4">{ICONS[form.icon]}</span>
                            <div>
                                <p className="text-body2 font-bold text-gray-800">{form.nickname}</p>
                                <p className="text-caption text-gray-500">GROWLAB-{form.serial} · 연결됨</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className="w-full bg-brand hover:bg-brand-deep text-white font-medium py-3 rounded-lg text-body2 transition-colors"
                        >홈으로 돌아가기</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AddDeviceModal;
