import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(6003),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string({
    error: "Postgres database url is required",
  }),
  REDIS_DATABASE_URL: z.string({
    error: "Redis database url is required",
  }),
  REDIS_DATABASE_PASSWORD: z.string({
    error: "Redis database password is required",
  }),
  REDIS_PORT: z.coerce.number({
    error: "Redis port is required",
  }),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parseResult.error.message);
  process.exit(1);
}

export const env = parseResult.data;

export type Env = z.infer<typeof envSchema>;
