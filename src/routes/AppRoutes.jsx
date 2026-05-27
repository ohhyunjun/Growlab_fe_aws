import React from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "../components/layouts/Layout";
import HomePage from "../pages/home/HomePage";
import ArticleListPage from "../pages/article/ArticleListPage";
import ArticleDetailPage from '../pages/article/ArticleDetailPage';
import ArticleCreatePage from '../pages/article/ArticleCreatePage';
import LoginPage from "../pages/auth/LoginPage";
import SignUpPage from "../pages/auth/SignUpPage";
import MyPage from "../pages/mypage/MyPage";
import ProtectedRoute from "../components/layouts/ProtectedRoute";
import NotificationPage from "../pages/notifications/NotificationPage";
import DiaryPage from "../pages/diary/DiaryPage";
import MonitoringPage from "../pages/monitoring/MonitoringPage";
import MarketPricePage from "../pages/marketprice/Marketpricepage";

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/articles" element={<ArticleListPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />
            <Route path="/articles/write" element={<ProtectedRoute><ArticleCreatePage /></ProtectedRoute>} />
            <Route path="/articles/edit/:id" element={<ProtectedRoute><ArticleCreatePage /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationPage /></ProtectedRoute>} />
            <Route path="/diary" element={<ProtectedRoute><DiaryPage /></ProtectedRoute>} />
            <Route path="/monitoring/:serialNumber" element={<MonitoringPage />} />
            <Route path="/market-price" element={<MarketPricePage />} />
        </Routes>
    )
}

export default AppRoutes;