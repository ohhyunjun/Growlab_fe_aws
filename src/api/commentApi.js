import axios from "axios";
import { API_BASE as ROOT_API_BASE } from "./config";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const getMyCommentsApi = (userId) =>
    axios.get(`${ROOT_API_BASE}/comments/my?userId=${userId}`, authHeader());