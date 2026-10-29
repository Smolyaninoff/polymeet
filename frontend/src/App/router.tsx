import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { FeedPage } from "@/pages/feed/FeedPage";
import { MyEventsPage } from "@/pages/my/MyEventsPage";
import { ModerationPage } from "@/pages/moderation/ModerationPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { NotFoundPage } from "@/pages/not-found/NotFoundPage";

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <FeedPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        path: "/my",
        element: (
          <RequireAuth>
            <MyEventsPage />
          </RequireAuth>
        ),
      },
      {
        path: "/moderation",
        element: (
          <RequireAuth>
            <ModerationPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
