import { Router } from "express";
import authRouter from "./auth.route.js";
import userRouter from "./user.route.js";
import { AuthError } from "@shared/dist/error-handler/index.js";

const router: Router = Router();

const publicEndpoints = [/\/username\/.*\/check/];

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

      (req as any).user = JSON.parse(decoded as string);

      next();
    } catch (error) {
      next(error);
    }
  },
  userRouter
);

export default router;
