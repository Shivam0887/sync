import { Redis } from "ioredis";
import { env } from "./env.js";

let redis: Redis;

if (env.NODE_ENV === "development") {
  // @ts-ignore
  if (!global._redis) {
    // @ts-ignore
    global._redis = new Redis({
      username: "default",
      password: env.REDIS_DATABASE_PASSWORD,
      host: env.REDIS_DATABASE_URL,
      port: env.REDIS_PORT,
    });
  }
  // @ts-ignore
  redis = global._redis;
} else {
  redis = new Redis({
    username: "default",
    password: env.REDIS_DATABASE_PASSWORD,
    host: env.REDIS_DATABASE_URL,
    port: env.REDIS_PORT,
  });
}

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("ready", () => {
  console.log("[Redis] Connection is ready for commands");
});

redis.on("error", (err) => {
  console.error("[Redis] Error:", err);
});

redis.on("close", () => {
  console.warn("[Redis] Connection closed");
});

redis.on("reconnecting", (time: number) => {
  console.log(`[Redis] Reconnecting in ${time}ms`);
});

export default redis;
