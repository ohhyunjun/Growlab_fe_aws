import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getUnreadCountApi } from "../../api/noticeApi";
import crumbHomeIcon from "../../assets/icons/crumb-home.svg";
import communityIcon from "../../assets/icons/nav-community.svg";
import priceIcon from "../../assets/icons/nav-price.svg";
import diaryIcon from "../../assets/icons/nav-diary.svg";
import mypageIcon from "../../assets/icons/nav-mypage.svg";
import homeIcon from "../../assets/icons/nav-home.svg";
import notificationIcon from "../../assets/icons/notification.svg";

// 상단 바 (PC 전용). Figma: 높이 88, 현재 위치(아이콘 32 + PC/H2 26/40 Bold) + 알림 버튼 40
const CRUMBS = [
    { match: (p) => p === "/", title: "홈", icon: crumbHomeIcon, size: 32 },
    { match: (p) => p.startsWith("/monitoring"), title: "모니터링", icon: homeIcon, size: 28 },
    { match: (p) => p.startsWith("/articles"), title: "커뮤니티", icon: communityIcon, size: 28 },
    { match: (p) => p.startsWith("/market-price"), title: "도소매 가격", icon: priceIcon, size: 28 },
    { match: (p) => p.startsWith("/diary"), title: "다이어리", icon: diaryIcon, size: 28 },
    { match: (p) => p.startsWith("/mypage"), title: "마이페이지", icon: mypageIcon, size: 28 },
    { match: (p) => p.startsWith("/admin"), title: "관리자", icon: mypageIcon, size: 28 },
    { match: (p) => p.startsWith("/notifications"), title: "알림", icon: notificationIcon, size: 32 },
];

// narrow: 홈처럼 1100 폭 콘텐츠 / 그 외 페이지는 기존 container-page 폭에 맞춤
function TopBar({ narrow = false }) {
    const { pathname } = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);
    const crumb = CRUMBS.find((c) => c.match(pathname));

    // 홈 '전체 환경 요약'에 있던 미확인 알림 수 → 알림 버튼의 점으로 표시
    useEffect(() => {
        if (!localStorage.getItem("token")) return;
        getUnreadCountApi()
            .then((res) => setUnreadCount(res.data))
            .catch((err) => console.error(err));
    }, [pathname]);

    return (
        <header className="hidden h-[88px] shrink-0 flex-col items-center justify-end gap-[22px] lg:flex">
            <div className={`flex items-center justify-between ${narrow ? "w-full max-w-[1140px] px-5" : "container-page"}`}>
                <div className="flex items-center gap-3">
                    {crumb && (
                        <>
                            <span className="flex size-8 items-center justify-center">
                                <img src={crumb.icon} alt="" width={crumb.size} height={crumb.size} />
                            </span>
                            <h1 className="text-h3 font-bold text-brand">{crumb.title}</h1>
                        </>
                    )}
                </div>
                <Link
                    to="/notifications"
                    aria-label={unreadCount > 0 ? `알림 (미확인 ${unreadCount}건)` : "알림"}
                    className="relative flex size-10 items-center justify-center rounded bg-white transition-colors hover:bg-gray-200"
                >
                    <img src={notificationIcon} alt="" width="32" height="32" />
                    {unreadCount > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-error" />}
                </Link>
            </div>
            <div className="h-0.5 w-full max-w-[1580px] bg-gray-300" />
        </header>
    );
}

export default TopBar;
