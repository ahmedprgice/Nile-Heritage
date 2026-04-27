import api from "@/lib/http";
import { getCachedRequest } from "@/lib/requestCache";

const getUserId = (user) => user?._id || user?.id || user?.userId || "";

const normalizeRole = (user) =>
  user?.role ||
  user?.userRole ||
  user?.position ||
  user?.title ||
  "Member";

const normalizeUser = (user) => {
  const name =
    user?.name ||
    user?.fullName ||
    user?.username ||
    (user?.email ? String(user.email).split("@")[0] : "");

  return {
    id: getUserId(user),
    name: name || "User",
    email: user?.email || "",
    role: normalizeRole(user),
  };
};

const pickList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.members)) return data.members;
  return [];
};

export const listDirectoryUsers = async () => {
  try {
    const data = await getCachedRequest(
      "directory:company-members:data",
      async () => (await api.get("/api/auth/company-members")).data,
      { ttlMs: 15000 },
    );
    const users = pickList(data);
    return users
      .map(normalizeUser)
      .filter((user, index, array) => {
        const key = user.id || user.email || user.name;
        if (!key) return false;
        return array.findIndex((entry) => (entry.id || entry.email || entry.name) === key) === index;
      });
  } catch {
    try {
      const data = await getCachedRequest(
        "directory:chat-users:data",
        async () => (await api.get("/api/chat/users")).data,
        { ttlMs: 15000 },
      );
      const users = pickList(data);
      return users
        .map(normalizeUser)
        .filter((user, index, array) => {
          const key = user.id || user.email || user.name;
          if (!key) return false;
          return array.findIndex((entry) => (entry.id || entry.email || entry.name) === key) === index;
        });
    } catch {
      return [];
    }
  }
};
