import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const useNetworkChange = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const handleNetworkChange = async () => {
      try {
        await fetch(`${API_BASE_URL}/health`, {
          method: "HEAD",
          cache: "no-store",
        });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
        setOfflineCount((prev) => prev + 1);
      }
    };

    if (navigator.onLine) handleNetworkChange();

    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);

    return () => {
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
    };
  }, []);

  return { isOnline, offlineCount };
};

export default useNetworkChange;
