export const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
export const API_BASE = `${API_ORIGIN}/api`;

export const serverUrl = (path = "") => `${API_ORIGIN}${path}`;

export const assetUrl = (path = "") => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
};
