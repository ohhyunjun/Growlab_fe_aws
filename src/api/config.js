const DEPLOYED_API_ORIGIN = "https://wwfgppukzf.execute-api.ap-northeast-2.amazonaws.com";
const envApiOrigin = import.meta.env.VITE_API_BASE_URL;

export const API_ORIGIN =
    envApiOrigin?.startsWith("http://growlab-backend.") ? DEPLOYED_API_ORIGIN : envApiOrigin || DEPLOYED_API_ORIGIN;
export const API_BASE = `${API_ORIGIN}/api`;

export const serverUrl = (path = "") => `${API_ORIGIN}${path}`;
