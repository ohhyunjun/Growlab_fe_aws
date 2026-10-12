import { useState } from "react";
import { Link } from "react-router-dom";
import NavLinks from "./NavLinks";

function Navigation() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
            <div className="container-page">
                <div className="flex justify-between items-center h-16">
                    {/* 로고 */}
                    <Link className="flex items-center gap-2 font-bold text-brand text-sub1" to="/" onClick={() => setIsOpen(false)}>
                        🌱 GrowLab
                        <span className="text-caption text-gray-500 font-normal hidden sm:block">스마트팜 관리 플랫폼</span>
                    </Link>

                    {/* 데스크탑 메뉴 */}
                    <ul className="hidden md:flex items-center space-x-1">
                        <NavLinks />
                    </ul>

                    {/* 모바일 햄버거 */}
                    <div className="md:hidden">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-500 hover:text-brand focus:outline-none">
                            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                                {isOpen ? (
                                    <path fillRule="evenodd" clipRule="evenodd" d="M18.278 16.864a1 1 0 01-1.414 1.414l-4.829-4.828-4.828 4.828a1 1 0 01-1.414-1.414l4.828-4.829-4.828-4.828a1 1 0 011.414-1.414l4.829 4.828 4.828-4.828a1 1 0 111.414 1.414l-4.828 4.829 4.828 4.828z" />
                                ) : (
                                    <path fillRule="evenodd" d="M4 5h16a1 1 0 010 2H4a1 1 0 110-2zm0 6h16a1 1 0 010 2H4a1 1 0 010-2zm0 6h16a1 1 0 010 2H4a1 1 0 010-2z" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 모바일 드롭다운 */}
                <div className={`${isOpen ? "block" : "hidden"} md:hidden pb-4`}>
                    <ul className="flex flex-col space-y-1">
                        <NavLinks onClick={() => setIsOpen(false)} isMobile={true} />
                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default Navigation;