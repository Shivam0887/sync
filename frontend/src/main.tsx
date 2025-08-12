import "./index.css";

// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { router } from "./routes/index";

createRoot(document.getElementById("root")!).render(
  <>
    <RouterProvider router={router} />
  </>
);
