import axios from "axios";
import { API_BASE } from "./config";

const url = serialNumber => `${API_BASE}/devices/${encodeURIComponent(serialNumber)}/diaries`;
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

export const getDiariesApi = serialNumber => axios.get(url(serialNumber), authHeader());
export const getDiaryByIdApi = (serialNumber, id) => axios.get(`${url(serialNumber)}/${id}`, authHeader());
export const createDiaryApi = (serialNumber, formData) => axios.post(url(serialNumber), formData, authHeader());
export const updateDiaryApi = (serialNumber, id, formData) => axios.put(`${url(serialNumber)}/${id}`, formData, authHeader());
export const deleteDiaryApi = (serialNumber, id) => axios.delete(`${url(serialNumber)}/${id}`, authHeader());
