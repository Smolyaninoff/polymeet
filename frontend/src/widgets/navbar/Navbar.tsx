import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Heart, LogOut, Settings2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/context";

function reliability(rate: number | null, marked: number): string {
  // Отметок явки пока нет — надёжность неизвестна, а не нулевая
  if (rate === null) return "пока нет оценок";
  return `${Math.round(rate * 100)}% · ${marked} встреч`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const tabs = [
  { to: "/", label: "Встречи", icon: CalendarDays },
  { to: "/my", label: "Мои события", icon: Heart },
  { to: "/moderation", label: "настройки", icon: Settings2 },
];
interface NavbarProps {
  onCreateClick?: () => void;
}

export function Navbar({ onCreateClick }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleCreate = () => {
    if (user) onCreateClick?.();
    else navigate("/login", { state: { from: location.pathname } });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-350 items-center gap-3 px-4 md:gap-6 md:px-6">
        {/* Logo — always visible */}
        <NavLink
          to="/"
          className="text-[15px] font-medium tracking-tight text-foreground"
        >
          PolyMeet
        </NavLink>

        {/* Tabs — desktop only */}
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

        {/* Right side — pushed to the far edge */}
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          {/* Create: icon-only on mobile, full button on desktop */}
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
                <span className="text-[13px] font-medium text-foreground">{user.display_name}</span>
                <span className="text-[11px] text-muted-foreground">
                  надёжность: {reliability(user.attendance_rate, user.marked_count)}
                </span>
              </div>
              <button
                onClick={() => navigate("/moderation")}
                title="Настройки"
                className="grid size-8 place-items-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground transition hover:ring-2 hover:ring-blue-500/50"
              >
                {initials(user.display_name)}
              </button>
              <button
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
                title="Выйти"
                aria-label="Выйти"
                className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              state={{ from: location.pathname }}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/5"
            >
              Войти
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}