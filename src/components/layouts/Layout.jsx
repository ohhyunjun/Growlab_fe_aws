import Footer from "./Footer";
import Header from "./Header";
import { useLocation } from "react-router-dom";

function Layout({ children }) {
    const { pathname } = useLocation();
    const fullScreen = pathname === "/login" || pathname === "/signup";

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Header />
            <main className={fullScreen
                ? "flex-grow p-0"
                : "flex-grow max-w-7xl w-full mx-auto px-6 py-6"
            }>
                {children}
            </main>
            <Footer />
        </div>
    )
}

export default Layout;