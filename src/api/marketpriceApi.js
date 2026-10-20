import axios from "axios";
import { API_BASE as ROOT_API_BASE } from "./config";

const API_BASE = `${ROOT_API_BASE}/prices`;

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
 * 최근 7개 거래일 가격 조회
 * @param {string} itemCode
 * @param {string} kindCode
 * @param {"RETAIL"|"WHOLESALE"} marketType
 */
export const getWeeklyPrice = (itemCode, kindCode, marketType = "RETAIL") => {
    return axios.get(`${API_BASE}/weekly`, {
        params: { itemCode, kindCode, marketType },
    });
};
