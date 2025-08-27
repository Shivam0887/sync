import { Router } from "express";
import authRouter from "./auth.route.js";
import userRouter from "./user.route.js";
import { AuthError } from "@shared/dist/error-handler/index.js";
import z from "zod/v4";

const router: Router = Router();

const publicEndpoints = [/\/username\/.*\/check/];

const decodedUserSchema = z.object({
  id: z.string({ error: "user id is missing" }),
  email: z.email({ error: "user email is missing" }),
});

router.use("/auth", authRouter);
router.use(
  "/user",
  (req, res, next) => {
    try {
      if (publicEndpoints.some((endpoint) => endpoint.test(req.path))) {
        next();
        return;
      }

      const decoded = req.headers["x-forwarded-user"];
      if (!decoded) throw new AuthError("Please login to continue...");

      (req as any).user = decodedUserSchema.parse(
        JSON.parse(decoded as string)
      );

      next();
    } catch (error) {
      next(error);
    }
  },
  userRouter
);

export default router;
