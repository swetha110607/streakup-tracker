import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, Flame, StickyNote } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HABITS, type Habit } from "@/lib/habits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StreakUp — Track every habit. Build every skill." },
      {
        name: "description",
        content:
          "Log your DSA progress, workouts, reading, and more — all in one place.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell>
      <Hero />
      <Features />
    </AppShell>
  );
}

function Hero() {
  const [habit, setHabit] = React.useState<Habit | "">("");
  const navigate = useNavigate();

  return (
    <section className="py-12 text-center">
      <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Track every habit. Build every skill.
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Log your DSA progress, workouts, reading, and more — all in one place.
      </p>

      <div className="mx-auto mt-8 flex max-w-xl flex-col items-center justify-center gap-3 sm:flex-row">
        <Select value={habit} onValueChange={(v) => setHabit(v as Habit)}>
          <SelectTrigger className="h-11 w-full bg-card sm:w-72">
            <SelectValue placeholder="Select a habit to track..." />
          </SelectTrigger>
          <SelectContent>
            {HABITS.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="lg"
          className="h-11 w-full sm:w-auto"
          onClick={() => navigate({ to: "/log", search: { habit: habit || undefined } })}
        >
          Start Tracking
        </Button>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: BarChart3,
      title: "Visual Progress",
      desc: "Daily bar charts for every habit",
    },
    {
      icon: Flame,
      title: "Daily Streaks",
      desc: "Stay consistent, stay motivated",
    },
    {
      icon: StickyNote,
      title: "Smart Notes",
      desc: "Key points per topic, always handy",
    },
  ];

  return (
    <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((it) => (
        <Card key={it.title} className="flex flex-col items-start gap-3 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <it.icon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{it.title}</h3>
          <p className="text-sm text-muted-foreground">{it.desc}</p>
        </Card>
      ))}
    </section>
  );
}
