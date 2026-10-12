import { Link } from "react-router-dom";
import authBg from "../../assets/auth-bg.webp";

// 인증 화면 공통 틀 (Figma 기준 1920: 패널 240~828 / 폼 972~1560, 둘 다 588px)
// 1440 콘텐츠를 588 | 144 | 588 | 120 비율로 나눔
// wide: 폼 708px(972~1680) — 아이디/비밀번호 찾기·회원가입처럼 입력+버튼 한 줄인 화면
// top: 제목 시작 위치 — 기본 200, 회원가입은 80 (Figma)
function AuthLayout({ children, wide = false, top = 200 }) {
    return (
        // 화면 자체를 스크롤 영역으로 두고 스크롤바 자리를 양쪽에 항상 확보
        // → 스크롤이 생기는 화면(로그인·회원가입)과 안 생기는 화면(찾기)의 좌우 위치가 같음
        <div className="h-(--screen-h) overflow-y-auto bg-gray-100 [scrollbar-gutter:stable_both-edges]">
            <div className="container-page min-h-full grid grid-cols-1 lg:grid-cols-[588fr_144fr_588fr_120fr]">
                {/* 좌측 패널 (PC 전용): Figma처럼 항상 화면 높이로 고정 → 그라데이션 비율이 모든 화면에서 동일 */}
                <aside
                    className="hidden lg:block lg:col-start-1 lg:sticky lg:top-0 lg:h-(--screen-h) bg-cover bg-center pt-20 px-11"
                    style={{ backgroundImage: `url(${authBg})` }}
                >
                    <Logo light />
                    <p className="mt-12 text-h1 font-bold text-white">
                        더 똑똑하게 키우고,
                        <br />
                        더 효율적으로 수확하다
                    </p>
                </aside>

                {/* 우측 폼 */}
                {/* 제목 top 고정 (단계가 늘어나도 위치가 흔들리지 않게) */}
                <section className={`${wide ? "lg:col-start-3 lg:col-span-2" : "lg:col-start-3"} py-12 ${top === 80 ? "lg:pt-20" : "lg:pt-[200px]"} lg:pb-20`}>
                    <div className="lg:hidden mb-12">
                        <Logo />
                    </div>
                    {children}
                </section>
            </div>
        </div>
    );
}

// TODO: 로고 파일 전달되면 교체 (디자인상 40x40 심볼 + 192x40 워드마크)
function Logo({ light = false }) {
    return (
        <Link to="/" className="flex items-center gap-2 h-10">
            <span className="w-10 h-10 flex items-center justify-center text-h4" aria-hidden="true">🌱</span>
            <span className={`text-h3 font-bold ${light ? "text-white" : "text-brand"}`}>GrowLab</span>
        </Link>
    );
}

export default AuthLayout;
