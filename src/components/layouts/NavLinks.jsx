import { Link, useNavigate } from "react-router-dom";


function NavLinks({ onClick }) {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        navigate("/login");
        if (onClick) onClick();
    };

    const baseStyle = "px-4 py-2 text-sm font-medium text-gray-600 hover:text-green-600 transition-colors";

    return (
        <>
            <li><Link className={baseStyle} to="/articles" onClick={onClick}>👥 커뮤니티</Link></li>
            <li><Link className={baseStyle} to="/notifications" onClick={onClick}>🔔 알림</Link></li>
            {token ? (
                <>
                    <li><button className={baseStyle} onClick={handleLogout}>🚪 로그아웃</button></li>
                </>
            ) : (
                <>
                    <li><Link className={baseStyle} to="/login" onClick={onClick}>🔑 로그인</Link></li>
                    <li><Link className={baseStyle} to="/signup" onClick={onClick}>✍️ 회원가입</Link></li>
                </>
            )}
        </>
    );
}

export default NavLinks;