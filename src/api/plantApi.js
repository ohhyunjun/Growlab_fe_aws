import axios from "axios";
import { API_BASE as ROOT_API_BASE } from "./config";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const createPlantApi = async (plantData) => {
    const token = localStorage.getItem("token");

    return await axios.post(
        `${ROOT_API_BASE}/plants`,
        plantData,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
};

export const deletePlantApi = (plantId) =>
    axios.delete(`${ROOT_API_BASE}/plants/${plantId}`, authHeader());

export const finishPlantApi = (plantId, reason) =>
    axios.post(`${ROOT_API_BASE}/plants/${plantId}/finish`, { reason }, authHeader());
