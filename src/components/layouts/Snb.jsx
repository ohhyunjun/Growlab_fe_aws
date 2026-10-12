import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import foldIcon from "../../assets/icons/snb-fold.svg";
import foldOpenIcon from "../../assets/icons/snb-fold-open.svg";
import homeIcon from "../../assets/icons/nav-home.svg";
import communityIcon from "../../assets/icons/nav-community.svg";
import priceIcon from "../../assets/icons/nav-price.svg";
import diaryIcon from "../../assets/icons/nav-diary.svg";
import mypageIcon from "../../assets/icons/nav-mypage.svg";
import userIcon from "../../assets/icons/user.svg";

// 좌측 내비게이션 (PC 전용). Figma: 펼침 340 / 접힘 100
const NAV_ITEMS = [
    { to: "/", label: "홈", icon: homeIcon, match: (p) => p === "/" || p.startsWith("/monitoring") },
    { to: "/articles", label: "커뮤니티", icon: communityIcon, match: (p) => p.startsWith("/articles") },
    { to: "/market-price", label: "도소매 가격", icon: priceIcon, match: (p) => p.startsWith("/market-price") },
    { to: "/diary", label: "다이어리", icon: diaryIcon, match: (p) => p.startsWith("/diary") },
    { to: "/mypage", label: "마이페이지", icon: mypageIcon, match: (p) => p.startsWith("/mypage") || p.startsWith("/admin") },
];

const COLLAPSED_KEY = "snb_collapsed";

// 접고 펼칠 때 서랍처럼 밀려 들어가고 나오는 움직임 (폭·글자가 함께 0.3초 동안 변함)
const SLIDE = "duration-300 ease-in-out motion-reduce:transition-none";
// 글자: 접히면 폭 0 + 투명 → 잘리면서 사라짐
const labelSlide = (collapsed, openClass) =>
    `overflow-hidden whitespace-nowrap transition-all ${SLIDE} ${collapsed ? "w-0 opacity-0" : `${openClass} opacity-100`}`;

function Snb() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
    const [menuOpen, setMenuOpen] = useState(false);
    const userRef = useRef(null);

    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    const toggleCollapsed = (next) => {
        setCollapsed(next);
        setMenuOpen(false);
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    };

    // 기존 상단 메뉴(NavLinks)의 로그아웃과 동일한 동작
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("userId");
        localStorage.removeItem("role");
        setMenuOpen(false);
        navigate("/login");
    };

    useEffect(() => {
        if (!menuOpen) return;
        const close = (e) => {
            if (!userRef.current?.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [menuOpen]);

    return (
        <aside
            className={`hidden lg:flex sticky top-0 z-30 h-(--screen-h) shrink-0 flex-col justify-between bg-white pt-6 transition-[width] ${SLIDE} ${collapsed ? "w-[100px]" : "w-[340px]"}`}
        >
            <div className="flex h-[400px] flex-col px-6">
                {/* 로고 + 접기 버튼 */}
                <div className="flex h-9 items-center justify-between">
                    <div className="flex items-center">
                        {collapsed ? (
                            // 접힘: 로고에 마우스를 올리면 펼치기 아이콘으로 바뀜
                            <button
                                type="button"
                                onClick={() => toggleCollapsed(false)}
                                aria-label="메뉴 펼치기"
                                className="group size-9 shrink-0"
                            >
                                <LogoMark className="group-hover:hidden group-focus-visible:hidden" />
                                <img src={foldOpenIcon} alt="" width="36" height="36" className="hidden group-hover:block group-focus-visible:block" />
                            </button>
                        ) : (
                            <Link to="/" aria-label="GrowLab 홈" className="size-9 shrink-0">
                                <LogoMark />
                            </Link>
                        )}
                        <Link
                            to="/"
                            tabIndex={collapsed ? -1 : undefined}
                            aria-hidden={collapsed}
                            className={`text-h4 font-bold text-brand ${labelSlide(collapsed, "ml-3 w-[172px]")}`}
                        >
                            GrowLab
                        </Link>
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleCollapsed(true)}
                        aria-label="메뉴 접기"
                        tabIndex={collapsed ? -1 : undefined}
                        aria-hidden={collapsed}
                        className={`shrink-0 overflow-hidden rounded transition-all hover:bg-gray-100 ${SLIDE} ${collapsed ? "pointer-events-none w-0 opacity-0" : "w-9 opacity-100"}`}
                    >
                        <img src={foldIcon} alt="" width="36" height="36" className="max-w-none" />
                    </button>
                </div>

                {/* 로고(36) 아래 48 → 메뉴 시작 y84 (Figma, 펼침·접힘 동일) */}
                <nav aria-label="주 메뉴" className="mt-12">
                    <ul className="flex flex-col gap-6">
                        {NAV_ITEMS.map(({ to, label, icon, match }) => {
                            const selected = match(pathname);
                            return (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        aria-current={selected ? "page" : undefined}
                                        aria-label={collapsed ? label : undefined}
                                        title={collapsed ? label : undefined}
                                        className={`flex items-center rounded-lg transition-all ${SLIDE} ${
                                            collapsed ? "w-9 gap-0 p-1" : "w-[292px] gap-3 px-3 py-2"
                                        } ${selected ? "bg-brand-cream" : "hover:bg-gray-100"}`}
                                    >
                                        <img src={icon} alt="" width="28" height="28" className="shrink-0" />
                                        <span className={`text-sub1 text-brand ${selected ? "font-bold" : "font-medium"} ${labelSlide(collapsed, "w-28")}`}>
                                            {label}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>

            {/* 하단: 계정 */}
            <div className="flex h-[100px] flex-col items-center gap-[22px]">
                <div className="h-0.5 w-full shrink-0 bg-gray-100" />
                <div ref={userRef} className="relative">
                    <button
                        type="button"
                        onClick={() => (token ? setMenuOpen((v) => !v) : navigate("/login"))}
                        aria-haspopup={token ? "menu" : undefined}
                        aria-expanded={token ? menuOpen : undefined}
                        aria-label={collapsed ? (token ? username || "계정" : "로그인") : undefined}
                        className={`flex items-center rounded bg-white px-2 py-1 transition-all hover:bg-gray-100 ${SLIDE} ${collapsed ? "w-[52px] gap-0" : "w-[292px] gap-3"}`}
                    >
                        <img src={userIcon} alt="" width="36" height="36" className="shrink-0" />
                        <span className={`text-left text-sub1 font-medium text-brand ${labelSlide(collapsed, "w-[152px]")} text-ellipsis`}>
                            {token ? username : "로그인"}
                        </span>
                    </button>

                    {/* 로그아웃 메뉴 — Figma 정렬 드롭다운과 같은 항목 스타일 */}
                    {menuOpen && (
                        <div role="menu" className="absolute bottom-[calc(100%+6px)] left-2 z-40">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleLogout}
                                className="w-28 rounded bg-gray-200 px-4 py-2 text-left text-body1 font-medium text-gray-600 hover:bg-gray-400 hover:text-black"
                            >
                                로그아웃
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}

// TODO: 로고 파일 전달되면 교체 (Figma상 36x36 심볼 + 172x36 워드마크 자리)
function LogoMark({ className = "" }) {
    return (
        <span className={`flex size-9 items-center justify-center text-h4 ${className}`} aria-hidden="true">🌱</span>
    );
}

export default Snb;
