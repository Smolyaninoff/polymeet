import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";

import { AppLayout } from "./AppLayout";
import { FeedPage } from "@/pages/feed/FeedPage";
import { MyEventsPage } from "@/pages/my/MyEventsPage";
import { ModerationPage } from "@/pages/moderation/ModerationPage";
import { AuthPage } from "@/pages/auth/AuthPage";
import { useAuth } from "@/features/auth/context";

function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <p className="p-10 text-center text-slate-400">
        Проверка авторизации…
      </p>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <FeedPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/my",
            element: <MyEventsPage />,
          },
          {
            path: "/moderation",
            element: <ModerationPage />,
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}