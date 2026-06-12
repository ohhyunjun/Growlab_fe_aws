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