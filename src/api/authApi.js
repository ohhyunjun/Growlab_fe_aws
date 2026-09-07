import axios from "axios";
import { API_BASE as BASE_API_URL } from "./config";

const API_BASE = `${BASE_API_URL}/auth`;

export const loginApi = (username, password) =>
    axios.post(`${API_BASE}/login`, { username, password });

export const signupApi = (username, email, password) =>
    axios.post(`${API_BASE}/signup`, { username, email, password });

export const updateUsernameApi = (newUsername, token) =>
    axios.put(`${API_BASE}/username`,
        { newUsername },
        { headers: { Authorization: `Bearer ${token}` } }
    );

export const updatePasswordApi = (oldPassword, newPassword, token) =>
    axios.put(`${API_BASE}/password`,
        { oldPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
    );

export const deleteUserApi = (password, token) =>
    axios.delete(`${API_BASE}/withdraw`, {
        params: { password },
        headers: { Authorization: `Bearer ${token}` }
    });

// ────────────────────────────────
// ✅ 이메일 인증 API (회원가입용)
// ────────────────────────────────

export const sendEmailCodeApi = (email) =>
    axios.post(`${API_BASE}/email/send-code`, { email });

export const verifyEmailCodeApi = (email, code) =>
    axios.post(`${API_BASE}/email/verify-code`, { email, code });

// ────────────────────────────────
// ✅ 비밀번호 재설정 API
// ────────────────────────────────

export const sendPasswordResetCodeApi = (email) =>
    axios.post(`${API_BASE}/password-reset/send-code`, { email });

export const resetPasswordApi = (email, newPassword) =>
    axios.post(`${API_BASE}/password-reset`, { email, newPassword });

// ────────────────────────────────
// ✅ 아이디 찾기 API
// ────────────────────────────────

export const sendFindIdCodeApi = (email) =>
    axios.post(`${API_BASE}/find-id/send-code`, { email });

export const findIdApi = (email) =>
    axios.post(`${API_BASE}/find-id`, { email });
