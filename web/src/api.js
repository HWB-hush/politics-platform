const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const { method = "GET", body, token } = options;
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const errorPayload = await response.json();
      message = errorPayload.message || message;
    } catch {
      // Ignore JSON parse failures and keep the fallback message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function fetchBriefing() {
  return request("/api/briefing");
}

export function fetchTopics() {
  return request("/api/topics");
}

export function fetchArticles({ category = "", query = "" } = {}) {
  const params = new URLSearchParams();

  if (category) params.set("category", category);
  if (query) params.set("q", query);

  const suffix = params.toString() ? `?${params.toString()}` : "";

  return request(`/api/articles${suffix}`);
}

export function fetchArticleDetail(slug) {
  return request(`/api/articles/${slug}`);
}

export function fetchRealtimeData() {
  return request("/api/realtime-data");
}

export function syncRealtimeData() {
  return request("/api/realtime-data/sync", {
    method: "POST"
  });
}

export function registerUser(payload) {
  return request("/api/auth/register", {
    method: "POST",
    body: payload
  });
}

export function loginUser(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: payload
  });
}

export function fetchCurrentUser(token) {
  return request("/api/auth/me", {
    token
  });
}

export function logoutUser(token) {
  return request("/api/auth/logout", {
    method: "POST",
    token
  });
}
