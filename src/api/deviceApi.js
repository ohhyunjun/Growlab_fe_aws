import axios from "axios";

const API_BASE = "http://localhost:8080/api/devices";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const getUserDevicesApi = () =>
    axios.get(API_BASE, authHeader());

export const registerDeviceApi = (serialNumber, deviceNickname) =>
    axios.post(`${API_BASE}/register`, { serialNumber, deviceNickname }, authHeader());

export const deleteDeviceApi = (serialNumber) =>
    axios.delete(`${API_BASE}/${serialNumber}`, authHeader());

export const updatePortStatusApi = (serialNumber, portIndex, status) =>
    axios.patch(`${API_BASE}/${serialNumber}/ports`, { portIndex, status }, authHeader());

export const updateLedApi = (serialNumber, payload) =>
    axios.patch(`${API_BASE}/${serialNumber}/led`, payload, authHeader());

export const updatePhotoIntervalApi = (serialNumber, photoInterval) =>
    axios.patch(`${API_BASE}/${serialNumber}/photo_interval`, { photoInterval }, authHeader());

// ✅ 기기 대표 품종 설정/변경 - PATCH /api/devices/{serialNumber}/species
export const updateDeviceSpeciesApi = (serialNumber, speciesId) =>
    axios.patch(`${API_BASE}/${serialNumber}/species`, { speciesId }, authHeader());

// ────────────────────────────────
// ✅ 관리자 전용 API (ROLE_ADMIN 필요)
// ────────────────────────────────

// 관리자가 유효한 시리얼 번호를 미리 등록 (사용자가 이 시리얼로만 내 기기 등록 가능)
export const adminCreateDeviceApi = (serialNumber) =>
    axios.post(API_BASE, { serialNumber }, authHeader());

// 관리자가 기기를 완전히 삭제 (소유자 상관없이)
export const adminDeleteDeviceApi = (serialNumber) =>
    axios.delete(`${API_BASE}/admin/${serialNumber}`, authHeader());