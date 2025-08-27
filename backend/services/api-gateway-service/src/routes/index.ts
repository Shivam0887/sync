import type { ServiceMap, ServiceName } from "@/types/index.js";

import { Router } from "express";
import { services } from "@/lib/constants.js";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { httpReverseProxy, serviceAvailability } from "@/middlewares";
import { rateLimiter } from "@/lib/rate-limiter";

const router: Router = Router();

const authRateLimiter = rateLimiter({
  limit: 5,
  message: "Too many signin attempts",
  path: "/signin",
});

// Create circuit breakers for each service
const circuitBreakers = {} as ServiceMap;
Object.keys(services).forEach((serviceName) => {
  circuitBreakers[serviceName as ServiceName] = new CircuitBreaker();
});

router.use(
  /\/auth|\/user/,
  authRateLimiter,
  serviceAvailability("user", circuitBreakers["user"]),
  httpReverseProxy("user")
);

router.use(
  /\/socket|\/chat/,
  serviceAvailability("chat", circuitBreakers["chat"]),
  httpReverseProxy("chat", { ws: true })
);

export default router;
