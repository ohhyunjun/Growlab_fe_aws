import axios from "axios";

const API_BASE = "http://localhost:8080/api/prices";

/**
 * 최신 가격 조회 (소매 or 도매 1건)
 * @param {string} itemCode
 * @param {string} kindCode
 * @param {"RETAIL"|"WHOLESALE"} marketType
 */
export const getLatestPrice = (itemCode, kindCode, marketType = "RETAIL") => {
    return axios.get(`${API_BASE}/latest`, {
        params: { itemCode, kindCode, marketType },
    });
};

/**
 * 최근 7일 가격 조회
 * @param {string} itemCode
 * @param {string} kindCode
 * @param {"RETAIL"|"WHOLESALE"} marketType
 */
export const getWeeklyPrice = (itemCode, kindCode, marketType = "RETAIL") => {
    return axios.get(`${API_BASE}/weekly`, {
        params: { itemCode, kindCode, marketType },
    });
};