import api from "@/lib/http";

export const getTasks = () => api.get("/api/tasks");

export const createTask = (data) => api.post("/api/tasks", data);

export const updateTask = (id, data) => api.put(`/api/tasks/${id}`, data);

export const deleteTask = (id) => api.delete(`/api/tasks/${id}`);
