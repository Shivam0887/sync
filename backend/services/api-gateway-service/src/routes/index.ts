import type { ServiceMap, ServiceName } from "@/types/index.js";

import { Router } from "express";
import { services } from "@/lib/constants.js";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { httpReverseProxy, serviceAvailability } from "@/middlewares";

const router: Router = Router();

// Create circuit breakers for each service
const circuitBreakers = {} as ServiceMap;
Object.keys(services).forEach((serviceName) => {
  circuitBreakers[serviceName as ServiceName] = new CircuitBreaker();
});

router.use(
  /\/auth|\/user/,
  serviceAvailability("user", circuitBreakers["user"]),
  httpReverseProxy("user")
);

router.use(
  /\/socket|\/chat/,
  serviceAvailability("chat", circuitBreakers["chat"]),
  httpReverseProxy("chat", { ws: true })
);

export default router;
