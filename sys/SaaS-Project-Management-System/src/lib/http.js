import axios from "axios";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
    }
    if (
      typeof window !== "undefined" &&
      error?.response?.status === 402 &&
      error?.response?.data?.code === "SUBSCRIPTION_REQUIRED"
    ) {
      const allowedPaths = ["/dashboard/subscription-required", "/dashboard/subscription"];
      if (!allowedPaths.some((path) => window.location.pathname.startsWith(path))) {
        window.location.href = "/dashboard/subscription-required";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
