// marketpriceApi.js
import axios from "axios";

const API_BASE = "http://localhost:8080/api/prices";

const authHeader = () => {
    const token = localStorage.getItem("token");
    return token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};  // ✅ 토큰 없으면 헤더 자체를 안 보냄
};
/**
 * 최신 가격 조회 (도매 or 소매 1건)
 * @param {string} itemCode
 * @param {string} kindCode
 */
export const getLatestPrice = (itemCode, kindCode) => {
    return axios.get(`${API_BASE}/latest`, {
        params: { itemCode, kindCode },
        ...authHeader(),
    });
};

/**
 * 최근 7일 가격 조회
 * @param {string} itemCode
 * @param {string} kindCode
 */
export const getWeeklyPrice = (itemCode, kindCode) => {
    return axios.get(`${API_BASE}/weekly`, {
        params: { itemCode, kindCode },
        ...authHeader(),
    });
};