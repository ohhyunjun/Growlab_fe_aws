import axios from "axios";
import { API_BASE as BASE_API_URL } from "./config";

const API_BASE = `${BASE_API_URL}/sensor_logs`;

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// 1분마다 실시간 센서값 전송 (DB 저장 X, SSE → 프론트)
export const postRealtimeSensorApi = (data) =>
    axios.post(`${API_BASE}/realtime`, data, authHeader());

// 1시간 평균 센서값 저장 (DB O)
export const postHourlySensorApi = (data) =>
    axios.post(API_BASE, data, authHeader());

// AWS API Gateway는 SSE 롱커넥션에 취약하므로 배포판은 최신값 폴링을 사용합니다.
export const getLatestSensorApi = (serialNumber) =>
    axios.get(`${API_BASE}/latest/${serialNumber}`, authHeader());
