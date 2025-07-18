import type { Service } from "@/types";

// Service registry - In production, this would come from a service discovery system
export const services: Service = {
  user: {
    url: "http://localhost:8001/api",
    timeout: 5000,
    retries: 3,
    healthCheck: "http://localhost:8001/api/health",
  },
};
