import axios from "axios";
import { API_BASE } from "./config";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const getAllSpeciesApi = () => axios.get(`${API_BASE}/species`, authHeader());

// ────────────────────────────────
// ✅ 관리자 전용 API (ROLE_ADMIN 필요)
// ────────────────────────────────

// (관리자) 새 품종 등록
export const createSpeciesApi = (speciesData) =>
    axios.post(`${API_BASE}/species`, speciesData, authHeader());

// (관리자) 품종 수정
export const updateSpeciesApi = (speciesId, speciesData) =>
    axios.put(`${API_BASE}/species/${speciesId}`, speciesData, authHeader());

// (관리자) 품종 삭제
export const deleteSpeciesApi = (speciesId) =>
    axios.delete(`${API_BASE}/species/${speciesId}`, authHeader());
