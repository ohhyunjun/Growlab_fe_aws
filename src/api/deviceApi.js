import axios from "axios";
import { API_BASE as BASE_API_URL } from "./config";

const API_BASE = `${BASE_API_URL}/devices`;

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

 // 전체 기기(시리얼) 목록 조회 - 배정/미배정 모두 포함
export const getAllDevicesAdminApi = () =>
    axios.get(`${API_BASE}/admin`, authHeader());

// 관리자가 유효한 시리얼 번호를 미리 등록
export const adminCreateDeviceApi = (serialNumber) =>
    axios.post(API_BASE, { serialNumber }, authHeader());

// 관리자가 기기를 완전히 삭제 (소유자 상관없이)
export const adminDeleteDeviceApi = (serialNumber) =>
    axios.delete(`${API_BASE}/admin/${serialNumber}`, authHeader());
