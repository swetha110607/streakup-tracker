import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  HABIT_ICONS,
  calcStreak,
  isoNDaysAgo,
  todayISO,
  type Habit,
} from "@/lib/habits";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StreakUp" },
      { name: "description", content: "Your habit progress, streaks, and weekly chart." },
    ],
  }),
  component: DashboardPage,
});

interface LogRow {
  id: string;
  habit: string;
  date: string;
  topic: string | null;
  questions_easy: number;
  questions_medium: number;
  questions_hard: number;
  duration: number | null;
  pages: number | null;
  description: string | null;
  note: string | null;
  created_at: string;
}

function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [logs, setLogs] = React.useState<LogRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      setLogs((data ?? []) as LogRow[]);
      setLoading(false);
    })();
  }, [user]);

  const allDates = React.useMemo(() => logs.map((l) => l.date), [logs]);
  const overallStreak = React.useMemo(() => calcStreak(allDates), [allDates]);

  const totalQuestions = React.useMemo(
    () =>
      logs.reduce(
        (sum, l) => sum + l.questions_easy + l.questions_medium + l.questions_hard,
        0,
      ),
    [logs],
  );
  const conceptsLearned = React.useMemo(
    () => logs.filter((l) => l.topic && l.topic.trim().length > 0).length,
    [logs],
  );
  const sevenDaysAgo = isoNDaysAgo(6);
  const weekQuestions = React.useMemo(
    () =>
      logs
        .filter((l) => l.date >= sevenDaysAgo)
        .reduce(
          (sum, l) => sum + l.questions_easy + l.questions_medium + l.questions_hard,
          0,
        ),
    [logs, sevenDaysAgo],
  );

  // Per-habit grouping
  const habitGroups = React.useMemo(() => {
    const map = new Map<string, LogRow[]>();
    for (const l of logs) {
      const arr = map.get(l.habit) ?? [];
      arr.push(l);
      map.set(l.habit, arr);
    }
    return map;
  }, [logs]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Current Streak"
          value={
            <span>
              🔥 {overallStreak} <span className="text-base font-normal">days</span>
            </span>
          }
        />
        <MetricCard label="Questions Solved" value={totalQuestions} />
        <MetricCard label="Concepts Learned" value={conceptsLearned} />
        <MetricCard label="This Week" value={weekQuestions} />
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            Last 7 days — DSA questions by difficulty
          </h2>
          <WeeklyChart logs={logs} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <LegendDot color="var(--streak-easy)" label="Easy" />
            <LegendDot color="var(--streak-medium)" label="Medium" />
            <LegendDot color="var(--streak-hard)" label="Hard" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            Streak calendar — this month
          </h2>
          <StreakCalendar dates={allDates} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <LegendSquare className="bg-primary" label="Completed" />
            <LegendSquare className="bg-[var(--streak-teal)]" label="Today" />
            <LegendSquare className="bg-muted" label="Missed" />
          </div>
        </Card>
      </div>

      {/* All active habits */}
      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold text-foreground">All active habits</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : habitGroups.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            No habits logged yet. Head to “Log Today” to start.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {Array.from(habitGroups.entries()).map(([habit, rows]) => (
              <HabitRow key={habit} habit={habit} rows={rows} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function LegendSquare({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function WeeklyChart({ logs }: { logs: LogRow[] }) {
  const days = React.useMemo(() => {
    const out: { day: string; date: string; Easy: number; Medium: number; Hard: number }[] =
      [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      out.push({ day: dayName, date: iso, Easy: 0, Medium: 0, Hard: 0 });
    }
    for (const l of logs) {
      const slot = out.find((d) => d.date === l.date);
      if (slot) {
        slot.Easy += l.questions_easy;
        slot.Medium += l.questions_medium;
        slot.Hard += l.questions_hard;
      }
    }
    return out;
  }, [logs]);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="Easy" stackId="q" fill="var(--streak-easy)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Medium" stackId="q" fill="var(--streak-medium)" />
          <Bar dataKey="Hard" stackId="q" fill="var(--streak-hard)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StreakCalendar({ dates }: { dates: string[] }) {
  const today = todayISO();
  const set = new Set(dates);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 Sun

  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, day: d });
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="h-7 w-7" />;
          const isToday = c.iso === today;
          const completed = set.has(c.iso);
          const isPast = c.iso < today;
          let cls = "bg-muted text-muted-foreground";
          if (isToday) cls = "bg-[var(--streak-teal)] text-white";
          else if (completed) cls = "bg-primary text-primary-foreground";
          else if (!isPast) cls = "bg-muted/50 text-muted-foreground";
          return (
            <div
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-medium ${cls}`}
              title={c.iso}
            >
              {c.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HabitRow({ habit, rows }: { habit: string; rows: LogRow[] }) {
  const Icon = HABIT_ICONS[habit as Habit] ?? HABIT_ICONS["Journaling"];
  const streak = calcStreak(rows.map((r) => r.date));
  const last = rows[0]; // already sorted desc
  const summary = summarize(last);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{habit}</div>
          <div className="truncate text-xs text-muted-foreground">{summary}</div>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
        🔥 {streak} day{streak === 1 ? "" : "s"}
      </span>
    </li>
  );
}

function summarize(l: LogRow): string {
  const parts: string[] = [`Last: ${l.date}`];
  const q = l.questions_easy + l.questions_medium + l.questions_hard;
  if (q > 0) parts.push(`${q} questions`);
  if (l.pages) parts.push(`${l.pages} pages`);
  if (l.duration) parts.push(`${l.duration} min`);
  if (l.topic) parts.push(l.topic);
  else if (l.description) parts.push(l.description);
  return parts.join(" · ");
}
