import { Router } from "express";
import { services } from "@/lib/constants.js";
import { CircuitBreaker } from "@/lib/utils.js";
import type { ServiceMap, ServiceName } from "@/types/index.js";
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
  httpReverseProxy("user", "/auth")
);

router.use(
  "/user",
  serviceAvailability("user", circuitBreakers["user"]),
  httpReverseProxy("user", "/user")
);

export default router;
