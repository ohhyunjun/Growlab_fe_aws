import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerDeviceApi } from "../../api/deviceApi";
import registeredIcon from "../../assets/icons/device-register-success.png";
import { DEVICE_ICONS } from "../../assets/deviceIcons";

const LOCATIONS = ["거실", "베란다", "주방", "침실", "서재", "기타"];
const STEPS = ["기기 정보", "연결 확인", "완료"];
const CONNECTION_CHECKS = [
    { pending: "기기 신호 탐색 확인 중...", complete: "기기 신호 탐색 완료" },
    { pending: "서버 연결 확인 중...", complete: "서버 연결 확인 완료" },
    { pending: "기기 상태점검 확인 중...", complete: "기기 상태점검 완료" },
];
const FIELD_CLASS = "h-10 min-w-0 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 text-body2 text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-leaf";
const PRIMARY_BUTTON = "h-8 rounded bg-brand px-5 text-body1 font-medium text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50";

function DeviceSymbol() {
    return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="shrink-0">
            <circle cx="20" cy="20" r="20" fill="currentColor" />
            <rect x="14.5" y="6.5" width="11" height="27" rx="1" stroke="white" />
            {[12, 20, 28].map(y => <circle key={y} cx="20" cy={y} r="1.6" stroke="white" />)}
        </svg>
    );
}

function ConnectionIcon({ done }) {
    return done ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="m7.5 12 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
            <path d="M4 2h16v2h-2v3a6 6 0 0 1-3.1 5A6 6 0 0 1 18 17v3h2v2H4v-2h2v-3a6 6 0 0 1 3.1-5A6 6 0 0 1 6 7V4H4V2Zm4 18h8v-3a4 4 0 0 0-8 0v3Z" />
        </svg>
    );
}

function StepIndicator({ step }) {
    return (
        <ol aria-label="기기 추가 단계" className="relative mt-4 flex justify-between">
            <li aria-hidden="true" className="absolute left-[50px] right-[50px] top-3.5 h-px bg-gray-300">
                <span className={`block h-full bg-brand ${step === 3 ? "w-full" : "w-1/2"}`} />
            </li>
            {STEPS.map((label, index) => {
                const number = index + 1;
                const done = number < step || step === 3;
                const current = number === step;
                return (
                    <li key={label} aria-current={current ? "step" : undefined} className="relative flex w-[100px] flex-col items-center gap-2">
                        <span className={`flex size-7 items-center justify-center rounded-full border text-body1 ${
                            done || number === 1 ? "border-brand bg-brand font-bold text-white"
                                : current ? "border-brand bg-white font-medium text-brand"
                                    : "border-gray-300 bg-gray-200 text-gray-400"
                        }`} aria-hidden="true">{number}</span>
                        <span className={`text-caption ${number <= step ? "text-brand" : "text-gray-400"}`}>
                            <span className="sr-only">{number}단계: </span>{label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function DeviceSummary({ form, connected = false }) {
    return (
        <div className="flex min-h-[108px] items-center gap-5 rounded-lg bg-gray-100 p-5">
            <img src={DEVICE_ICONS[form.icon].src} alt="" width="60" height="60" className="size-[60px] shrink-0 object-contain" />
            <div className="flex min-w-0 flex-col gap-2">
                <p className="break-words text-sub1 font-bold text-gray-800">{form.nickname}</p>
                <div className="flex flex-wrap items-center gap-3 text-body1 text-gray-500">
                    <p className="break-all">GROWLAB-{form.serial}{connected && " · 연결됨"}</p>
                    {!connected && form.location && <span className="rounded-full border border-gray-300 px-4 text-caption">{form.location}</span>}
                </div>
            </div>
        </div>
    );
}

function AddDeviceModal({ onClose, onSuccess }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ serial: "", nickname: "", icon: 0, location: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [completedChecks, setCompletedChecks] = useState(0);
    const dialogRef = useRef(null);
    const finishRef = useRef(null);
    const mountedRef = useRef(false);
    const submittingRef = useRef(false);
    const id = useId();

    useEffect(() => {
        mountedRef.current = true;
        const previouslyFocused = document.activeElement;
        const root = document.getElementById("root");
        const previousInert = root?.inert;
        const previousOverflow = document.body.style.overflow;
        if (root) root.inert = true;
        document.body.style.overflow = "hidden";
        dialogRef.current?.querySelector("input")?.focus();
        return () => {
            mountedRef.current = false;
            if (root) root.inert = previousInert;
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
        };
    }, []);

    useEffect(() => {
        if (step === 1) dialogRef.current?.querySelector("input")?.focus();
        if (step === 2) dialogRef.current?.focus();
        if (step === 3) finishRef.current?.focus();
    }, [step]);

    const close = () => {
        if (step === 3) onSuccess();
        onClose();
    };

    const handleSubmit = async event => {
        event.preventDefault();
        if (submittingRef.current) return;
        const serial = form.serial.trim();
        const nickname = form.nickname.trim();
        if (!serial || !nickname) {
            setError("시리얼 번호와 기기 이름을 입력해주세요.");
            dialogRef.current?.querySelector(!serial ? '[name="serial"]' : '[name="nickname"]')?.focus();
            return;
        }
        submittingRef.current = true;
        setForm(previous => ({ ...previous, serial, nickname }));
        setError("");
        setCompletedChecks(0);
        setStep(2);
        setLoading(true);

        // These are presentation stages; the existing registration endpoint does not
        // provide individual hardware-check events. API success gates the last stages.
        const pause = () => new Promise(resolve => setTimeout(resolve, 700));
        try {
            await pause();
            if (!mountedRef.current) return;
            setCompletedChecks(1);
            await registerDeviceApi(`GROWLAB-${serial}`, nickname);
            localStorage.setItem(`device_icon_GROWLAB-${serial}`, String(form.icon));
            for (const completed of [2, 3]) {
                await pause();
                if (!mountedRef.current) { onSuccess(); return; }
                setCompletedChecks(completed);
            }
            await pause();
            if (!mountedRef.current) { onSuccess(); return; }
            setStep(3);
        } catch (err) {
            if (!mountedRef.current) return;
            const message = err.response?.data?.message || err.response?.data;
            setError(typeof message === "string" ? message : "기기 등록에 실패했습니다.");
            setStep(1);
            setCompletedChecks(0);
        } finally {
            submittingRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    };

    const handleKeyDown = event => {
        if (event.key === "Escape") {
            event.stopPropagation();
            close();
        }
        if (event.key !== "Tab") return;
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
            event.preventDefault(); first.focus();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-busy={loading}
                tabIndex={-1} onKeyDown={handleKeyDown}
                className="max-h-[calc(100dvh-32px)] w-full max-w-[560px] overflow-y-auto rounded-lg bg-white p-4 shadow-xl outline-none">
                <header className="flex h-16 items-center gap-4 border-b border-gray-200 pb-2 text-brand">
                    <DeviceSymbol />
                    <h2 id={`${id}-title`} className="text-sub1 font-medium text-gray-800">기기 추가</h2>
                </header>
                <StepIndicator step={step} />

                {step === 1 && (
                    <form noValidate onSubmit={handleSubmit} className="mt-8">
                        {error && <p role="alert" className="mb-5 rounded-lg bg-error-bg px-4 py-3 text-body2 text-error">{error}</p>}
                        <div className="flex flex-col gap-5">
                            <div>
                                <label htmlFor={`${id}-serial`} className="mb-2 block text-body1 text-gray-500">시리얼 번호 <span className="text-error" aria-hidden="true">*</span></label>
                                <div className="flex h-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 focus-within:ring-2 focus-within:ring-brand-leaf">
                                    <span className="flex shrink-0 items-center border-r border-gray-200 bg-gray-200 px-3 text-body2 text-gray-600">GROWLAB-</span>
                                    <input id={`${id}-serial`} name="serial" required type="text" value={form.serial} maxLength={5}
                                        onChange={event => setForm(previous => ({ ...previous, serial: event.target.value.toUpperCase() }))}
                                        placeholder="예시: A001" autoComplete="off" spellCheck={false}
                                        className="min-w-0 flex-1 px-3 text-body2 text-gray-800 placeholder:text-gray-500 focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor={`${id}-nickname`} className="mb-2 block text-body1 text-gray-500">기기 이름 <span className="text-error" aria-hidden="true">*</span></label>
                                <input id={`${id}-nickname`} name="nickname" required type="text" value={form.nickname} maxLength={20}
                                    onChange={event => setForm(previous => ({ ...previous, nickname: event.target.value }))}
                                    placeholder="예: 거실 스마트팜" aria-describedby={`${id}-nickname-help`} className={FIELD_CLASS} />
                                <p id={`${id}-nickname-help`} className="mt-1 text-caption text-gray-400">최대 20자 이내</p>
                            </div>
                            <fieldset>
                                <legend className="mb-2 text-body1 text-gray-500">기기 아이콘</legend>
                                <div className="grid grid-cols-4 justify-items-center gap-4 min-[560px]:grid-cols-8">
                                    {DEVICE_ICONS.map((icon, index) => (
                                        <button key={icon.label} type="button" aria-label={`${icon.label} 아이콘`} aria-pressed={form.icon === index}
                                            onClick={() => setForm(previous => ({ ...previous, icon: index }))}
                                            className="group relative flex size-[52px] items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                                            <img src={icon.src} alt="" width="52" height="52" className="size-[52px] object-contain" />
                                            <span aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded border transition-colors ${form.icon === index ? "border-brand" : "border-transparent group-hover:border-brand-leaf"}`} />
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <fieldset>
                                <legend className="mb-2 text-body1 text-gray-500">설치 위치</legend>
                                <div className="grid grid-cols-3 gap-3 min-[560px]:grid-cols-6">
                                    {LOCATIONS.map(location => (
                                        <button key={location} type="button" aria-pressed={form.location === location}
                                            onClick={() => setForm(previous => ({ ...previous, location: previous.location === location ? "" : location }))}
                                            className={`h-8 rounded-full border text-body1 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${form.location === location ? "border-brand bg-brand-cream text-brand" : "border-gray-200 bg-gray-100 text-gray-600 hover:border-brand-leaf"}`}>
                                            {location}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        </div>
                        <footer className="mt-9 flex justify-end gap-3">
                            <button type="submit" disabled={loading} className={`${PRIMARY_BUTTON} w-[108px]`}>확인</button>
                            <button type="button" onClick={close} className="h-8 w-[108px] rounded bg-gray-200 text-body1 font-medium text-gray-700 transition-colors hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-brand">취소</button>
                        </footer>
                    </form>
                )}

                {step === 2 && (
                    <div className="mt-8">
                        <h3 className="mb-2 text-body1 text-gray-500">기기 정보 확인</h3>
                        <DeviceSummary form={form} />
                        <h3 className="mb-2 mt-6 text-body1 text-gray-500">연결 상태 확인</h3>
                        <ul role="status" aria-live="polite" aria-label="기기 등록 진행 상황" className="flex min-h-14 flex-col gap-2">
                            {CONNECTION_CHECKS.map((check, index) => {
                                const done = index < completedChecks;
                                return (
                                    <li key={check.complete} className={`flex min-h-14 items-center gap-4 rounded-lg border px-4 py-3 text-body1 ${done ? "border-brand-bright/40 bg-success-bg text-brand" : "border-yellow-200 bg-yellow-50 text-gray-600"}`}>
                                        <ConnectionIcon done={done} />
                                        <span>{done ? check.complete : check.pending}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {step === 3 && (
                    <div className="mt-8">
                        <div className="flex flex-col items-center pt-2 text-center" role="status">
                            <img src={registeredIcon} alt="" width="140" height="140" className="size-[140px] object-contain" />
                            <h3 className="mt-8 text-h4 font-bold text-gray-800">기기 등록 완료!</h3>
                            <p className="mt-3 text-body1 text-gray-500">스마트팜 기기가 성공적으로 연결되었습니다.</p>
                        </div>
                        <div className="mt-8"><DeviceSummary form={form} connected /></div>
                        <footer className="mt-12 flex justify-end">
                            <button ref={finishRef} type="button" onClick={close} className={PRIMARY_BUTTON}>홈으로 돌아가기</button>
                        </footer>
                    </div>
                )}
            </section>
        </div>,
        document.body,
    );
}

export default AddDeviceModal;
