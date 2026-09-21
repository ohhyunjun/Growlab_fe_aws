import axios from "axios";
import { API_BASE as BASE_API_URL } from "./config";

const API_BASE = `${BASE_API_URL}/photos`;

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// 포트별 성장 추이(관측 크기) + 또래 비교 조회
export const getGrowthTrendApi = (serialNumber, portIndex) =>
    axios.get(`${API_BASE}/growth-trend`, {
        ...authHeader(),
        params: { serialNumber, portIndex },
    });
