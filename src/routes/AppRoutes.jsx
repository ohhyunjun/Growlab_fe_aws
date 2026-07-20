import React from "react";
import { Route, Routes } from "react-router-dom";
import HomePage from "../pages/home/HomePage";
import ArticleListPage from "../pages/article/ArticleListPage";
import ArticleDetailPage from '../pages/article/ArticleDetailPage';
import ArticleCreatePage from '../pages/article/ArticleCreatePage';
import LoginPage from "../pages/auth/LoginPage";
import SignUpPage from "../pages/auth/SignUpPage";
import MyPage from "../pages/mypage/MyPage";
import ProtectedRoute from "../components/layouts/ProtectedRoute";
import AdminRoute from "../components/layouts/AdminRoute";
import NotificationPage from "../pages/notifications/NotificationPage";
import DiaryPage from "../pages/diary/DiaryPage";
import MonitoringPage from "../pages/monitoring/MonitoringPage";
import MarketPricePage from "../pages/marketprice/Marketpricepage";
import AdminPage from "../pages/admin/AdminPage";

function AppRoutes() {
    return (
        <Routes>
            {/* 메인 홈 */}
            <Route path="/" element={<HomePage />} />

            {/* 게시글 관련 */}
            <Route path="/articles" element={<ArticleListPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />

            <Route
                path="/articles/write"
                element={<ProtectedRoute><ArticleCreatePage /></ProtectedRoute>}
            />
            <Route
                path="/articles/edit/:id"
                element={<ProtectedRoute><ArticleCreatePage /></ProtectedRoute>}
            />

            {/* 인증 관련 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            {/* 마이페이지 및 알림 (로그인 필요) */}
            <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationPage /></ProtectedRoute>} />

            <Route path="/diary" element={<ProtectedRoute><DiaryPage /></ProtectedRoute>} />

            <Route path="/monitoring/:serialNumber" element={<MonitoringPage />} />

            {/* 도소매 가격 */}
            <Route path="/market-price" element={<MarketPricePage />} />

            {/* ✅ 관리자 전용 */}
            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Routes>
    )
}

export default AppRoutes;