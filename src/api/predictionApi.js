import axios from "axios";

const API_BASE = "http://localhost:8080/api/predictions";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// plant_id 기준 최신 예측 조회
export const getLatestPredictionApi = (plantId) =>
    axios.get(`${API_BASE}/${plantId}`, authHeader());