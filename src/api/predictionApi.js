import axios from "axios";
import { API_BASE as BASE_API_URL } from "./config";

const API_BASE = `${BASE_API_URL}/predictions`;

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// plant_id 기준 최신 예측 조회
export const getLatestPredictionApi = (plantId) =>
    axios.get(`${API_BASE}/${plantId}`, authHeader());
