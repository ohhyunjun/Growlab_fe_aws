import axios from "axios";
import { API_BASE } from "./config";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const getAllSpeciesApi = () => axios.get(`${API_BASE}/species`, authHeader());
export const createPlantApi = (data) => axios.post(`${API_BASE}/plants`, data, authHeader());
