import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "Access token secret must be at least 32 characters"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "Refresh token secret must be at least 32 characters"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_ISSUER: z.string({ required_error: "JWT issuer is missing" }),
  DATABASE_URL: z.string({
    required_error: "Postgres database url is required",
  }),
  REDIS_DATABASE_URL: z.string({
    required_error: "Redis database url is required",
  }),
  REDIS_DATABASE_PASSWORD: z.string({
    required_error: "Redis database password is required",
  }),
  REDIS_PORT: z.coerce.number({
    required_error: "Redis port is required",
  }),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Invalid environment variables:");
  parseResult.error.errors.forEach((error) => {
    console.error(`  ${error.path.join(".")}: ${error.message}`);
  });
  process.exit(1);
}

export const env = parseResult.data;

export type Env = z.infer<typeof envSchema>;
