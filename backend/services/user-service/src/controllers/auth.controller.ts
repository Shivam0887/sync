import { z } from "zod";
import { NextFunction, Request, Response } from "express";

import { emailSchema, passwordSchema } from "@/lib/schema/zod-schema.js";

import { eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";

import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { env } from "@/config/env.js";
import redis from "@/config/redis-db.js";
import {
  AuthError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@shared/dist/error-handler/index.js";
import { formatSeconds } from "@/lib/utils/index.js";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, { message: "Username must be at least 3 characters" })
  .max(255, { message: "Username can't be greater than 255 characters" });

const signupSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
});

const signinSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const ACCESS_TOKEN_SECRET = env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = env.REFRESH_TOKEN_SECRET;
const JWT_ISSUER = env.JWT_ISSUER;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const INVALID_CREDENTIALS_ATTEMPTS = 3;

const generateTokens = (payload: { id: string; email: string }) => {
  const jwtid = nanoid();

  const accessToken = jwt.sign(
    { ...payload, type: "access_token" },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      audience: "web-client",
      issuer: JWT_ISSUER,
      jwtid,
      subject: payload.id,
    }
  );

  const refreshToken = jwt.sign(
    { ...payload, type: "refresh_token" },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      audience: "web-client",
      issuer: JWT_ISSUER,
      jwtid,
      subject: payload.id,
    }
  );

  return { accessToken, refreshToken };
};

const handleInvalidCredentials = async (email: string) => {
  const keyExists = await redis.get(`invalid_cred:${email}`);

  const remainingAttempts = keyExists
    ? Number(keyExists) - 1
    : INVALID_CREDENTIALS_ATTEMPTS;

  if (remainingAttempts === 0) {
    await redis.set(`invalid_cred:${email}`, 0, "EX", 2 * 60 * 60, "XX"); // Expires in 2 hours
    throw new AuthError("Account locked for 2 hours");
  }

  if (keyExists) await redis.decr(`invalid_cred:${email}`);
  else await redis.set(`invalid_cred:${email}`, INVALID_CREDENTIALS_ATTEMPTS);

  throw new AuthError(
    `Invalid credentials. ${
      remainingAttempts > 1
        ? `${remainingAttempts} attempts left`
        : "One more wrong attempt, your account will be locked for 2 hours."
    } `
  );
};

// Called when access token expired
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthError("Refresh token required");
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, {
      issuer: JWT_ISSUER,
      audience: "web-client",
    }) as jwt.JwtPayload;

    // Find user
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.id));

    if (user.length === 0) {
      throw new NotFoundError("User not found");
    }

    if (decoded.type !== "refresh_token") {
      throw new AuthError("Unauthorized or invalid refresh token");
    }

    // Generate new access token
    const tokens = generateTokens({ email: user[0].email, id: user[0].id });

    res.status(200).json(tokens);
  } catch (error) {
    console.log("Refresh token error");
    next(error);
  }
};

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, username, password, confirmPassword } = signupSchema.parse(
      req.body
    );

    const isUserExists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (isUserExists.length) {
      throw new ConflictError("User with this email already exists");
    }

    if (password !== confirmPassword) {
      throw new ValidationError(
        "Password & confirm-password didn't matched",
        "message"
      );
    }

    const hashedPassword = await argon2.hash(password);

    const user = (
      await db
        .insert(usersTable)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          username: username.toLowerCase(),
        })
        .returning({
          id: usersTable.id,
          avatarUrl: usersTable.avatarUrl,
          username: usersTable.username,
        })
    )[0];

    const tokens = generateTokens({
      id: user.id,
      email,
    });

    res.status(201).json({ ...tokens, user: { ...user, email } });
  } catch (error) {
    console.error("Signup error");
    next(error);
  }
};

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = signinSchema.parse(req.body);

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (users.length === 0) {
      throw new AuthError("Invalid credentials");
    }

    // Check if account is locked
    const lockoutCheck = await redis.get(`invalid_cred:${email}`);
    if (lockoutCheck && parseInt(lockoutCheck) === 0) {
      const remainingTTL = await redis.ttl(`invalid_cred:${email}`);
      throw new AuthorizationError(
        `Account locked. Try after ${formatSeconds(remainingTTL)}`
      );
    }

    // Verify password
    const isValidPassword = await argon2.verify(users[0].password, password);

    if (isValidPassword) {
      await redis.del(`invalid_cred:${email}`);
    } else {
      await handleInvalidCredentials(email);
    }

    // Generate tokens
    const tokens = generateTokens({ email, id: users[0].id });

    res.json({
      user: {
        id: users[0].id,
        email,
        username: users[0].username,
        avatarUrl: users[0].avatarUrl,
      },
      ...tokens,
    });
  } catch (error) {
    console.log("Signin error");
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    // Add token to blacklist
    if (token) {
      await redis.set(`token-blacklist:${token}`, 1, "EX", 15 * 60);
    }

    res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error");
    next(error);
  }
};
