import Footer from "./Footer";
import Header from "./Header";
import Snb from "./Snb";
import TopBar from "./TopBar";
import { useLocation } from "react-router-dom";

function Layout({ children }) {
    const { pathname } = useLocation();
    // 페이지 스스로 전폭 배경 + container-page를 쓰는 경우
    const fullBleed = pathname.startsWith("/monitoring/");
    // 헤더/푸터 없이 AuthLayout 단독 화면
    const authScreen = ["/login", "/find-id", "/forgot-password", "/signup"].includes(pathname);
    // Figma 홈: 1100 폭 콘텐츠, 화면 높이에 맞춘 내부 스크롤 (푸터 없음)
    const isHome = pathname === "/";

    if (authScreen) return children;

    const mainClass = isHome
        ? "flex-grow w-full max-w-[1140px] mx-auto px-5 py-6 lg:pb-0"
        : fullBleed
            ? "flex-grow p-0"
            : "flex-grow container-page py-6 lg:py-10";

    return (
        <div className="min-h-(--screen-h) flex flex-col bg-gray-50 lg:flex-row lg:bg-gray-100">
            {/* 모바일: 기존 상단 메뉴 유지 / PC(lg~): 좌측 SNB + 상단 바 */}
            <div className="lg:hidden">
                <Header />
            </div>
            <Snb />
            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar narrow={isHome} />
                <main className={mainClass}>
                    {children}
                </main>
                {isHome ? <div className="lg:hidden"><Footer /></div> : <Footer />}
            </div>
        </div>
    )
}

export default Layout;
