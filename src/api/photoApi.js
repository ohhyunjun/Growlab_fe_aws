import axios from "axios";

const API_BASE = "http://localhost:8080/api/photos";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// 포트별 성장 추이(관측 크기) + 또래 비교 조회
export const getGrowthTrendApi = (serialNumber, portIndex) =>
    axios.get(`${API_BASE}/growth-trend`, {
        ...authHeader(),
        params: { serialNumber, portIndex },
    });
