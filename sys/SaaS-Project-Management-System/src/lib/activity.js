import api from "@/lib/http";

const ACTIVITY_ENDPOINTS = [
  "/api/activities",
  "/api/activity",
  "/api/activity/timeline",
  "/api/users/me/activities",
];

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.timeline)) return payload.timeline;
  return [];
};

export const normalizeActivity = (item, index = 0) => ({
  id: item?._id || item?.id || `activity-${index}`,
  text:
    item?.text ||
    item?.message ||
    item?.description ||
    item?.action ||
    item?.title ||
    "Activity update",
  time:
    item?.createdAt ||
    item?.timestamp ||
    item?.date ||
    item?.time ||
    null,
  actor:
    item?.actor?.name ||
    item?.user?.name ||
    item?.performedBy?.name ||
    item?.author ||
    "",
});

export async function fetchActivityFeed() {
  for (const endpoint of ACTIVITY_ENDPOINTS) {
    try {
      const res = await api.get(endpoint);
      const activities = toArray(res.data).map(normalizeActivity);
      return { activities, endpoint };
    } catch (error) {
      if (error?.response?.status === 402) {
        return { activities: [], endpoint: null };
      }
    }
  }
  return { activities: [], endpoint: null };
}
