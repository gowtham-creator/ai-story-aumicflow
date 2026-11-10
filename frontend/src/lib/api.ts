const API_URL = import.meta.env.VITE_API_URL || "http://backend:5000/api";

export async function apiFetch(endpoint: string, options: any = {}) {
  const token = localStorage.getItem("DEVV_CODE_SID");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
