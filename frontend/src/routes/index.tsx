import { lazy, Suspense } from "react";

import RootLayout from "@/layouts/root.layout";
import LandingPage from "@/pages/landing.page";

import { createBrowserRouter } from "react-router";
import ProtectedRoute from "./protected-route";

import Loader from "@/components/loader";
import ChatProvider from "@/providers/chat-provider";

const ChatLayout = lazy(() => import("@/layouts/chat.layout"));
const Chat = lazy(() => import("@/components/chat/chat"));

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: LandingPage,
      },
      {
        path: "chat",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<Loader />}>
              <ChatProvider>
                <ChatLayout />
              </ChatProvider>
            </Suspense>
          </ProtectedRoute>
        ),
        children: [
          {
            path: ":chatId",
            element: (
              <Suspense fallback={<Loader />}>
                <Chat />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
]);
