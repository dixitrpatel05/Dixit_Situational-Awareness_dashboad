const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export async function fetchDashboard(mode = "swing", force = false) {
  const params = new URLSearchParams({ mode });
  if (force) {
    params.set("force", "1");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/api/dashboard?${params.toString()}`);
  } catch {
    throw new Error(
      "Network error: dashboard API unreachable. Check backend service, VITE_API_BASE, or CORS origin settings."
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Dashboard request failed with status ${response.status}`);
  }
  return response.json();
}
