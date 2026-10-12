import { Link } from "react-router-dom";

// 인증 화면 공통 UI (Figma 기준)
// 제목 PC/Display/Bold, 부제 PC/H3/Regular, 라벨·입력 PC/Subtitle1/Medium
// size "lg": 로그인·찾기 화면(입력 68px) / "md": 회원가입 화면(입력 52px)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthHeading({ title, subtitle }) {
    return (
        <>
            <h1 className="text-h1 font-bold text-gray-950">{title}</h1>
            <p className="mt-1 text-h4 font-normal text-gray-600">{subtitle}</p>
        </>
    );
}

// 라벨 + 입력(또는 입력 행) + 안내/오류 문구
// md: 안내문구 PC/Body1/Regular gray-400, 입력과 간격 12 / status 칩 지원
export function AuthField({ label, htmlFor, hint, error, status, size = "lg", children }) {
    const md = size === "md";
    return (
        <div>
            <label htmlFor={htmlFor} className="block mb-2 text-sub1 font-medium text-gray-600">{label}</label>
            {children}
            {status ? (
                <div className="mt-2">{status}</div>
            ) : error ? (
                md
                    ? <div className="mt-2"><StatusChip type="error">{error}</StatusChip></div>
                    : <p role="alert" className="mt-2 text-body2 text-red-600">{error}</p>
            ) : hint ? (
                <p className={md ? "mt-3 text-body1 text-gray-400" : "mt-2 text-body2 text-gray-500"}>{hint}</p>
            ) : null}
        </div>
    );
}

// 상태 칩 (Figma: 인증 완료 / 인증번호 불일치)
// success: 폭 488 가운데정렬, error: 내용 폭(full이면 전폭)
export function StatusChip({ type, full = false, className = "", children }) {
    const color = type === "success"
        ? "bg-brand-leaf/15 text-brand-leaf justify-center"
        : "bg-[rgba(255,56,60,0.14)] text-[#ff383c]";
    const width = full ? "flex w-full" : "inline-flex max-w-full";
    return (
        <p role={type === "error" ? "alert" : "status"} className={`${width} rounded px-3 py-0.5 text-body1 ${color} ${className}`}>
            {children}
        </p>
    );
}

// 입력창: lg 높이 68(padding 20/32) / md 높이 52(padding 12/24), radius 4, 흰 배경
export function AuthInput({ size = "lg", className = "", ...props }) {
    const box = size === "md" ? "h-[52px] px-6" : "h-[68px] px-8";
    return (
        <input
            {...props}
            className={`w-full min-w-0 ${box} rounded bg-white text-sub1 font-medium text-gray-950 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand disabled:text-gray-500 ${className}`}
        />
    );
}

// 입력 + 우측 액션 버튼 한 줄, 간격 24
export function AuthInputRow({ children }) {
    return <div className="flex gap-4 lg:gap-6">{children}</div>;
}

// 인증번호 받기 등 보조 버튼: 비활성 gray-300/gray-500, 활성 main/white
// done: 완료 상태(gray-700/white, 클릭 불가) — Figma '인증 완료'
// lg 220×68 PC/H3/Medium / md 196×52 PC/Subtitle1/Medium
export function AuthActionButton({ size = "lg", done = false, children, ...props }) {
    const box = size === "md"
        ? "h-[52px] px-4 lg:px-5 lg:w-[196px] text-sub1"
        : "h-[68px] px-4 lg:px-8 lg:w-[220px] text-h4";
    const color = done
        ? "bg-gray-700 text-white cursor-default"
        : "bg-brand text-white hover:bg-brand-deep disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed";
    return (
        <button
            type="button"
            {...props}
            className={`shrink-0 rounded font-medium whitespace-nowrap transition-colors ${box} ${color}`}
        >
            {children}
        </button>
    );
}

// 전폭 주 버튼 (로그인, 재설정 등) — md: 회원가입 하기(높이 60, PC/H3/Medium)
export function AuthPrimaryButton({ size = "lg", children, className = "", ...props }) {
    const box = size === "md" ? "h-[60px] text-h4" : "h-[68px] text-sub1";
    return (
        <button
            {...props}
            className={`w-full ${box} rounded bg-brand font-medium text-white transition-colors hover:bg-brand-deep disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed ${className}`}
        >
            {children}
        </button>
    );
}

// 박스 링크 버튼: 기본 흰 박스(로그인으로 돌아가기), primary는 main 배경
export function AuthBoxLink({ to, children, variant = "white", className = "" }) {
    const color = variant === "primary"
        ? "bg-brand text-white hover:bg-brand-deep"
        : "bg-white text-brand hover:bg-gray-50";
    return (
        <Link
            to={to}
            className={`flex items-center justify-center h-[68px] rounded text-sub1 font-medium transition-colors ${color} ${className}`}
        >
            {children}
        </Link>
    );
}
