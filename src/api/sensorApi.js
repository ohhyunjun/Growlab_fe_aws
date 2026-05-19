import axios from "axios";

const API_BASE = "http://localhost:8080/api/sensor_logs";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// 1분마다 실시간 센서값 전송 (DB 저장 X, SSE → 프론트)
export const postRealtimeSensorApi = (data) =>
    axios.post(`${API_BASE}/realtime`, data, authHeader());

// 1시간 평균 센서값 저장 (DB O)
export const postHourlySensorApi = (data) =>
    axios.post(API_BASE, data, authHeader());

// SSE 구독 URL 반환 (EventSource는 헤더 불가, URL만 반환)
export const getSseStreamUrl = (serialNumber) =>
    `http://localhost:8080/api/sensor_logs/stream/${serialNumber}`;