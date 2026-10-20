const localHostname = window.location.hostname;
const defaultApiOrigin = ["localhost", "127.0.0.1"].includes(localHostname)
    ? `http://${localHostname}:8080`
    : "http://localhost:8080";
export const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || defaultApiOrigin;
export const API_BASE = `${API_ORIGIN}/api`;

export const serverUrl = (path = "") => `${API_ORIGIN}${path}`;

export const assetUrl = (path = "") => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
};
