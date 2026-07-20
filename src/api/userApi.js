import axios from "axios";
import { API_BASE as BASE_API_URL } from "./config";

const API_BASE = `${BASE_API_URL}/admin/users`;

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// ────────────────────────────────
// ✅ 관리자 전용 회원 관리 API (ROLE_ADMIN 필요)
// ────────────────────────────────

// 전체 회원 목록 조회
export const getAllUsersAdminApi = () =>
    axios.get(API_BASE, authHeader());

// 회원 강제 탈퇴
export const adminDeleteUserApi = (userId) =>
    axios.delete(`${API_BASE}/${userId}`, authHeader());

// 회원 권한 변경 (role: "ROLE_USER" | "ROLE_ADMIN")
export const adminUpdateUserRoleApi = (userId, role) =>
    axios.patch(`${API_BASE}/${userId}/role`, { role }, authHeader());
