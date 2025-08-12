const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) + "/api";

export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  const resp = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!resp.ok) throw new Error("Session expired");

  const refreshData = await resp.json();

  const newAccessToken = refreshData.accessToken as string;
  const newRefreshToken = refreshData.refreshToken as string;

  localStorage.setItem("accessToken", newAccessToken);
  localStorage.setItem("refreshToken", newRefreshToken);

  return {
    newAccessToken,
    newRefreshToken,
  };
};

export const apiRequest = async (url: string, options?: RequestInit) => {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  let response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (response.status === 401 && refreshToken) {
    const { newAccessToken } = await refreshAccessToken();

    response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        Authorization: `Bearer ${newAccessToken}`,
        "Content-Type": "application/json",
      },
      ...options,
    });
  }

  return response;
};
