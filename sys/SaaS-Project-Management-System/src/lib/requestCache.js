const valueCache = new Map();
const inflightCache = new Map();

const now = () => Date.now();

const isFresh = (entry) => {
  if (!entry) return false;
  return entry.expiresAt > now();
};

export const getCachedRequest = async (
  key,
  fetcher,
  { ttlMs = 10000, force = false } = {},
) => {
  if (!key || typeof fetcher !== "function") {
    return fetcher?.();
  }

  if (!force) {
    const cached = valueCache.get(key);
    if (isFresh(cached)) {
      return cached.value;
    }

    const inflight = inflightCache.get(key);
    if (inflight) {
      return inflight;
    }
  }

  const requestPromise = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      valueCache.set(key, {
        value,
        expiresAt: now() + Math.max(0, Number(ttlMs) || 0),
      });
      inflightCache.delete(key);
      return value;
    })
    .catch((error) => {
      inflightCache.delete(key);
      throw error;
    });

  inflightCache.set(key, requestPromise);
  return requestPromise;
};

export const invalidateRequestCache = (keyOrPrefix = "") => {
  const needle = String(keyOrPrefix || "");

  if (!needle) {
    valueCache.clear();
    inflightCache.clear();
    return;
  }

  [...valueCache.keys()].forEach((key) => {
    if (key === needle || key.startsWith(needle)) {
      valueCache.delete(key);
    }
  });

  [...inflightCache.keys()].forEach((key) => {
    if (key === needle || key.startsWith(needle)) {
      inflightCache.delete(key);
    }
  });
};

