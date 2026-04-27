import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "StreakUp — Track every habit. Build every skill." },
      {
        name: "description",
        content:
          "Log your DSA progress, workouts, reading, and more — all in one place. Build streaks and track progress with StreakUp.",
      },
      { property: "og:title", content: "StreakUp — Track every habit. Build every skill." },
      {
        property: "og:description",
        content: "Log progress, build streaks, and stay consistent with StreakUp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "StreakUp — Track every habit. Build every skill." },
      { name: "description", content: "StreakUp is a web application for tracking habits and progress with visual feedback." },
      { property: "og:description", content: "StreakUp is a web application for tracking habits and progress with visual feedback." },
      { name: "twitter:description", content: "StreakUp is a web application for tracking habits and progress with visual feedback." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a05f37c6-58f4-41a1-baeb-ebd5d9cc3eac/id-preview-95e26c52--3d342015-cd20-4ded-b436-c53e05c90fc6.lovable.app-1777210463210.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a05f37c6-58f4-41a1-baeb-ebd5d9cc3eac/id-preview-95e26c52--3d342015-cd20-4ded-b436-c53e05c90fc6.lovable.app-1777210463210.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
