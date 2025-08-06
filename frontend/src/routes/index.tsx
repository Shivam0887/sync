import { lazy, Suspense } from "react";

import RootLayout from "@/layouts/root.layout";
import LandingPage from "@/pages/landing.page";

import { createBrowserRouter } from "react-router";
import ProtectedRoute from "./protected-route";

import Loader from "@/components/loader";

const ChatLayout = lazy(() => import("@/layouts/chat.layout"));
const Chat = lazy(() => import("@/components/chat/chat"));
const JoinGroupPage = lazy(() => import("@/pages/join-group.page"));

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
              <ChatLayout />
            </Suspense>
          </ProtectedRoute>
        ),
        children: [
          {
            path: ":chatId?",
            element: (
              <Suspense fallback={<Loader />}>
                <Chat />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "groups/join/:inviteToken",
        element: (
          <Suspense fallback={<Loader />}>
            <JoinGroupPage />
          </Suspense>
        ),
      },
    ],
  },
]);
