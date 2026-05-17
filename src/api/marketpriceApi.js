import axios from "axios";

const API_BASE = "http://localhost:8080/api/prices";

// 로컬 스토리지에서 토큰을 읽어와 인증 헤더를 만드는 헬퍼 함수
const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

/**
 * 특정 품목의 최신 도소매 시세를 조회합니다.
 * @param {string} itemName - 품목명 (예: "적상추")
 */
export const getLatestPrice = (itemName) => {
    return axios.get(`${API_BASE}/latest`, {
        params: { itemName },
        ...authHeader()
    });
};

/**
 * 특정 품목의 최근 7일간의 주간 시세 추이를 조회합니다.
 * @param {string} itemName - 품목명 (예: "적상추")
 */
export const getWeeklyPrice = (itemName) => {
    return axios.get(`${API_BASE}/weekly`, {
        params: { itemName },
        ...authHeader()
    });
};