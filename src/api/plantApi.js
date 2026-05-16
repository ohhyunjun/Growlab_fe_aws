import axios from "axios";

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

export const createPlantApi = async (plantData) => {
    const token = localStorage.getItem("token");

    return await axios.post(
        "http://localhost:8080/api/plants",
        plantData,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
};

export const deletePlantApi = (plantId) =>
    axios.delete(`http://localhost:8080/api/plants/${plantId}`, authHeader());