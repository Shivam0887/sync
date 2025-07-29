import type { ServiceMap, ServiceName } from "@/types/index.js";

import { Router } from "express";
import { services } from "@/lib/constants.js";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { rateLimiter } from "@/lib/rate-limiter";
import { httpReverseProxy, serviceAvailability } from "@/middlewares";

const router: Router = Router();

// Create circuit breakers for each service
const circuitBreakers = {} as ServiceMap;
Object.keys(services).forEach((serviceName) => {
  circuitBreakers[serviceName as ServiceName] = new CircuitBreaker();
});

router.use(
  "/auth",
  serviceAvailability("user", circuitBreakers["user"]),
  rateLimiter(2, 60_000),
  httpReverseProxy("user", "/auth")
);

router.use(
  "/user",
  serviceAvailability("user", circuitBreakers["user"]),
  httpReverseProxy("user", "/user")
);

router.use(
  "/chat",
  serviceAvailability("chat", circuitBreakers["chat"]),
  httpReverseProxy("chat", "/chat", { ws: true })
);

export default router;
