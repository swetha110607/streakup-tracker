import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Welcome — StreakUp" },
      { name: "description", content: "Get started with StreakUp in seconds." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading, startWithName } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await startWithName(name);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary">StreakUp</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Track every habit. Build every skill.
          </p>
        </div>

        <Card className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's your name?"
              className="h-12 text-base"
              maxLength={60}
            />
            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
              {busy ? "Setting up…" : "Let's Go"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
