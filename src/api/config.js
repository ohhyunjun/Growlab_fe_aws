export const API_ORIGIN =
    import.meta.env.VITE_API_BASE_URL ||
    "https://wwfgppukzf.execute-api.ap-northeast-2.amazonaws.com";
export const API_BASE = `${API_ORIGIN}/api`;

export const serverUrl = (path = "") => `${API_ORIGIN}${path}`;
