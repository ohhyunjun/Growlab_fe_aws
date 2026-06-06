import axios from "axios";

const API_BASE = "http://localhost:8080/api/devices";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const getUserDevicesApi = () => axios.get(API_BASE, authHeader());
export const registerDeviceApi = (serialNumber, deviceNickname) =>
    axios.post(`${API_BASE}/register`, { serialNumber, deviceNickname }, authHeader());
export const deleteDeviceApi = (serialNumber) =>
    axios.delete(`${API_BASE}/${serialNumber}`, authHeader());

export const updatePortStatusApi = (serialNumber, portIndex, status) => {
    return axios.patch(
        `http://localhost:8080/api/devices/${serialNumber}/ports`, 
        { portIndex, status }, 
        authHeader()
    );
};

export const updateLedApi = (serialNumber, payload) =>
    axios.patch(`${API_BASE}/${serialNumber}/led`, payload, authHeader());
 
export const updatePhotoIntervalApi = (serialNumber, photoInterval) =>
    axios.patch(`${API_BASE}/${serialNumber}/photo_interval`, { photoInterval }, authHeader());