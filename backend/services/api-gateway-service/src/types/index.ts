import { CircuitBreaker } from "@shared/dist/circuit-breaker";

export type ServiceName = "user" | "chat";

interface ServiceConfig {
  url: string;
  timeout: number;
  retries: number;
  healthCheck: string;
}

export type Service = Record<ServiceName, ServiceConfig>;

export type TCircuitBreaker = InstanceType<typeof CircuitBreaker>;

export type ServiceMap = Record<ServiceName, TCircuitBreaker>;
