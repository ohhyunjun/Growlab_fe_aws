import axios from "axios";
import { API_BASE } from "./config";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const createPlantApi = async (plantData) => {
    const token = localStorage.getItem("token");

    return await axios.post(
        `${API_BASE}/plants`,
        plantData,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
};

export const deletePlantApi = (plantId) =>
    axios.delete(`${API_BASE}/plants/${plantId}`, authHeader());
