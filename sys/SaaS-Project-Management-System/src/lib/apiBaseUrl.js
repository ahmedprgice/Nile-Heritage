function normalizeApiBaseUrl(rawUrl) {
  if (!rawUrl) return "http://localhost:5000";

  return rawUrl.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
);

export default normalizeApiBaseUrl;
