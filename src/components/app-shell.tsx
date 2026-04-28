import * as React from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Sun, Moon, Users } from "lucide-react";
import { useAuth, avatarStyleById, getInitials } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { StudyBuddyWidget } from "@/components/study-buddy-widget";

const TABS = [
  { to: "/", label: "Home" },
  { to: "/log", label: "Log Today" },
  { to: "/friends", label: "Friends", icon: Users },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const displayName = profile?.name || "You";
  const initials = getInitials(displayName);
  const style = avatarStyleById(profile?.avatar_style);
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-xl font-bold text-primary">
            StreakUp
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-muted"
              aria-label="Open profile"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ backgroundColor: style.bg, color: style.fg }}
                >
                  {initials}
                </span>
              )}
              <span className="hidden pr-2 text-sm font-medium text-foreground sm:inline">
                {displayName}
              </span>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {TABS.map((t) => {
            const active = location.pathname === t.to;
            const Icon = "icon" in t ? t.icon : null;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`relative inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
