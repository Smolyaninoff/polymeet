import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, Heart, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/context";
import { useMyMeetings } from "@/features/user/hooks";
import { getUserInitials } from "@/features/user/presentation";

const tabs = [
  { to: "/", label: "Встречи", icon: CalendarDays },
  { to: "/my", label: "Мои события", icon: Heart },
  { to: "/moderation", label: "Настройки", icon: Settings2 },
];

interface NavbarProps {
  onCreateClick?: () => void;
}

export function Navbar({ onCreateClick }: NavbarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myMeetingsQuery = useMyMeetings(Boolean(user));

  const organizedCount =
    myMeetingsQuery.data?.pages.reduce(
      (total, page) => total + page.items.length,
      0
    ) ?? 0;
  const hasMoreMeetings = myMeetingsQuery.data?.pages.some(
    (page) => page.next_cursor
  );

  const handleCreate = () => {
    if (!user) {
      navigate("/auth", { state: { from: "/" } });
      return;
    }
    onCreateClick?.();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-350 items-center gap-3 px-4 md:gap-6 md:px-6">
        <NavLink
          to="/"
          className="text-[15px] font-medium tracking-tight text-foreground"
        >
          PolyMeet
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    isActive
                      ? "gap-2 rounded-full bg-secondary text-foreground hover:bg-secondary"
                      : "gap-2 rounded-full text-muted-foreground hover:bg-blue-600/10 hover:text-blue-400"
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <button
            onClick={handleCreate}
            className="grid size-9 place-items-center rounded-xl bg-linear-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-900/40 transition-transform hover:scale-[1.05] active:scale-[0.95] md:hidden"
            aria-label="Создать встречу"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={handleCreate}
            className="hidden items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition-transform hover:scale-[1.03] active:scale-[0.97] md:flex"
          >
            <Plus size={16} strokeWidth={2.5} />
            Создать встречу
          </button>

          {user ? (
            <>
              <div className="hidden flex-col items-end leading-tight sm:flex">
                <span className="text-[11px] text-muted-foreground">
                  {user.attendance_rate === null
                    ? "Нет отметок о посещении"
                    : `Надёжность ${Math.round(user.attendance_rate * 100)}%`}
                </span>
                <span className="text-[13px] font-semibold text-success">
                  {organizedCount}
                  {hasMoreMeetings ? "+" : ""} встреч организатором
                </span>
              </div>

              <button
                onClick={() => navigate("/moderation")}
                aria-label={`Открыть профиль ${user.display_name}`}
                className="grid size-8 place-items-center overflow-hidden rounded-full border border-border bg-blue-600/20 text-xs font-semibold text-blue-300 transition hover:ring-2 hover:ring-blue-500/50"
              >
                {getUserInitials(user.display_name)}
              </button>
            </>
          ) : (
            <NavLink
              to="/auth"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Войти
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
