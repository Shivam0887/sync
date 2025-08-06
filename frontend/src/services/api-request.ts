const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) + "/api";

export const apiRequest = async (url: string, options?: RequestInit) => {
  let accessToken = localStorage.getItem("accessToken");
  let refreshToken = localStorage.getItem("refreshToken");

  let response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshResponse.ok) throw new Error("Session expired");

    const refreshData = await refreshResponse.json();

    accessToken = refreshData.accessToken as string;
    refreshToken = refreshData.refreshToken as string;

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...options,
    });
  }

  return response;
};
