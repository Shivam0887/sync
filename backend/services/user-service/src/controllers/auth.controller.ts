// backend/user-service/src/controllers/auth.controller.ts

import { z, ZodError } from "zod";
import { Request, Response } from "express";

import { emailSchema, passwordSchema } from "@/lib/zod-schema.js";

import { eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";

import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { env } from "@/config/env.js";
// import redis from "@/config/redis-db.js";

const signupSchema = z.object({
  email: emailSchema,
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

// Called when access token expired
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({
        error: "Refresh token required",
      });
      return;
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
      res.status(401).json({
        error: "User not found",
      });
      return;
    }

    if (decoded.type !== "refresh_token") {
      res.status(401).json({
        error: "Unauthorized or invalid refresh token",
      });
      return;
    }

    // Generate new access token
    const tokens = generateTokens({ email: user[0].email, id: user[0].id });

    res.status(200).json(tokens);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        res.status(401).json({
          error: "Refresh token expired",
        });
      } else if (error.name === "JsonWebTokenError") {
        res.status(401).json({
          error: "Invalid refresh token",
        });
      }
    } else {
      console.error("Token refresh error:", error);
      res.status(500).json({
        error: "Internal server error during token refresh",
      });
    }
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, confirmPassword } = signupSchema.parse(req.body);

    const isUserExists =
      (
        await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, email))
      ).length > 0;

    if (isUserExists) {
      res.status(409).json({ message: "User with this email already exists" });
      return;
    }

    if (password !== confirmPassword) {
      res
        .status(400)
        .json({ message: "Password & confirm-password didn't matched" });
      return;
    }

    const hashedPassword = await argon2.hash(password);

    const user = (
      await db
        .insert(usersTable)
        .values({
          email,
          password: hashedPassword,
          username: email, // Will update the username on the username route
        })
        .returning({ id: usersTable.id })
    )[0];

    const payload = {
      id: user.id,
      email,
    };

    const tokens = generateTokens(payload);

    res.status(201).json({ ...tokens, user: { ...payload, username: email } });
  } catch (error) {
    console.error("Signup error:", error);

    if (error instanceof ZodError) {
      const errorMsg = error.errors.map(({ message }) => message).join(", ");
      res.status(500).json({
        error: errorMsg,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error during signup",
    });
  }
};

export const signin = async (req: Request, res: Response) => {
  try {
    const { email, password } = signinSchema.parse(req.body);

    // Find user
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (users.length === 0) {
      res.status(401).json({
        error: "Invalid credentials",
      });
      return;
    }

    // Check if account is locked
    // const lockoutCheck = checkAccountLockout(user);
    // if (lockoutCheck.locked) {
    //   return res.status(423).json({ // 423 = Locked
    //     error: lockoutCheck.message,
    //     code: 'ACCOUNT_LOCKED'
    //   });
    // }

    // Check if account is active
    // if (!user.isActive) {
    //   return res.status(401).json({
    //     error: 'Account is deactivated'
    //   });
    // }

    // Verify password
    const isValidPassword = await argon2.verify(users[0].password, password);

    if (!isValidPassword) {
      // handleFailedLogin(user);
      res.status(401).json({
        error: "Invalid credentials",
      });

      return;
    }

    // Successful login
    // handleSuccessfulLogin(user);

    // Generate tokens
    const tokens = generateTokens({ email, id: users[0].id });

    res.status(201).json({
      user: {
        id: users[0].id,
        email,
        username: users[0].username,
      },
      ...tokens,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMsg = error.errors
        .map(({ message, path }) => `${path}: ${message}\n`)
        .join("");
      console.log(errorMsg);
      res.status(500).json({
        error: errorMsg,
      });
    } else {
      res.status(500).json({
        error: "Internal server error during signin",
      });
    }
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    // Add token to blacklist
    // if (token) {
    //   redis.sadd("token-blacklist", token);
    // }

    res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Internal server error during logout",
    });
  }
};
