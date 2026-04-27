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
  Legend,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  calcStreak,
  iconForHabit,
  isoNDaysAgo,
  todayISO,
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
  amount: number | null;
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
  const [selectedHabit, setSelectedHabit] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    setLogs((data ?? []) as LogRow[]);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Refetch fresh data when the tab/window regains focus so newly logged entries appear.
  React.useEffect(() => {
    const onFocus = () => loadLogs();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadLogs]);

  // Habits the user has logged at least once, in order of most recent activity
  const loggedHabits = React.useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    // logs are sorted by date desc, then created_at via secondary; first occurrence wins
    const sorted = [...logs].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.created_at < b.created_at ? 1 : -1;
    });
    for (const l of sorted) {
      if (!seen.has(l.habit)) {
        seen.add(l.habit);
        ordered.push(l.habit);
      }
    }
    return ordered;
  }, [logs]);

  // Default selection = most recently logged habit
  React.useEffect(() => {
    if (!selectedHabit && loggedHabits.length > 0) {
      setSelectedHabit(loggedHabits[0]);
    }
  }, [loggedHabits, selectedHabit]);

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

  const habitLogs = React.useMemo(
    () => (selectedHabit ? logs.filter((l) => l.habit === selectedHabit) : []),
    [logs, selectedHabit],
  );
  const habitDates = React.useMemo(() => habitLogs.map((l) => l.date), [habitLogs]);

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

      {/* View Your Progress */}
      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-foreground">View Your Progress</h2>
          {loggedHabits.length > 0 && selectedHabit && (
            <div className="w-full sm:w-64">
              <Select value={selectedHabit} onValueChange={setSelectedHabit}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a habit" />
                </SelectTrigger>
                <SelectContent>
                  {loggedHabits.map((h) => {
                    const Icon = iconForHabit(h);
                    return (
                      <SelectItem key={h} value={h}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {h}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !selectedHabit ? (
          <p className="text-sm text-muted-foreground">
            No habits logged yet. Head to “Log Today” to start tracking.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Last 7 days — {selectedHabit}
              </h3>
              <HabitChart habit={selectedHabit} logs={habitLogs} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Streak calendar — this month
              </h3>
              <StreakCalendar dates={habitDates} />
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <LegendSquare className="bg-primary" label="Completed" />
                <LegendSquare className="bg-[var(--streak-teal)]" label="Today" />
                <LegendSquare className="bg-muted" label="Missed" />
              </div>
            </div>
          </div>
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

function LegendSquare({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

/* ---------------- Habit-aware chart ---------------- */

interface HabitChartConfig {
  /** unit shown in tooltip and Y axis label hint */
  unit: string;
  /** stacked = multiple bars per day; single = one numeric bar per day */
  mode: "stacked" | "single";
  /** for single mode */
  color?: string;
  label?: string;
  pick?: (l: LogRow) => number;
  /** for stacked mode */
  series?: { key: string; color: string; pick: (l: LogRow) => number }[];
}

function getHabitChartConfig(habit: string): HabitChartConfig {
  if (habit === "DSA & Coding") {
    return {
      unit: "questions",
      mode: "stacked",
      series: [
        { key: "Easy", color: "var(--streak-easy)", pick: (l) => l.questions_easy },
        { key: "Medium", color: "var(--streak-medium)", pick: (l) => l.questions_medium },
        { key: "Hard", color: "var(--streak-hard)", pick: (l) => l.questions_hard },
      ],
    };
  }
  if (habit === "Reading a Book") {
    return {
      unit: "pages",
      mode: "single",
      label: "Pages",
      color: "var(--streak-teal)",
      pick: (l) => l.pages ?? 0,
    };
  }
  if (habit === "Exercise & Workout") {
    return {
      unit: "minutes",
      mode: "single",
      label: "Minutes",
      color: "var(--streak-medium)",
      pick: (l) => l.duration ?? 0,
    };
  }
  if (habit === "Meditation") {
    return {
      unit: "minutes",
      mode: "single",
      label: "Minutes",
      color: "var(--streak-blue)",
      pick: (l) => l.duration ?? 0,
    };
  }
  if (habit === "Water Intake") {
    return {
      unit: "glasses",
      mode: "single",
      label: "Amount",
      color: "var(--streak-blue)",
      pick: (l) => l.amount ?? l.duration ?? l.pages ?? 0,
    };
  }
  // Default — covers Journaling, Sleep, Career, Music, Language, Nutrition, custom habits
  return {
    unit: "value",
    mode: "single",
    label: "Value",
    color: "var(--primary)",
    pick: (l) => l.amount ?? l.duration ?? l.pages ?? 0,
  };
}

function HabitChart({ habit, logs }: { habit: string; logs: LogRow[] }) {
  const config = React.useMemo(() => getHabitChartConfig(habit), [habit]);

  const days = React.useMemo(() => {
    const out: { day: string; date: string; [k: string]: string | number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const row: { day: string; date: string; [k: string]: string | number } = {
        day: dayName,
        date: iso,
      };
      if (config.mode === "stacked") {
        for (const s of config.series ?? []) row[s.key] = 0;
      } else {
        row[config.label ?? "Value"] = 0;
      }
      out.push(row);
    }
    for (const l of logs) {
      const slot = out.find((d) => d.date === l.date);
      if (!slot) continue;
      if (config.mode === "stacked") {
        for (const s of config.series ?? []) {
          slot[s.key] = (slot[s.key] as number) + s.pick(l);
        }
      } else {
        const key = config.label ?? "Value";
        slot[key] = (slot[key] as number) + (config.pick?.(l) ?? 0);
      }
    }
    return out;
  }, [logs, config]);

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
            formatter={(value, name) => [`${value} ${config.unit}`, name as string]}
          />
          {config.mode === "stacked" ? (
            <>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(config.series ?? []).map((s, idx) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="q"
                  fill={s.color}
                  radius={
                    idx === (config.series?.length ?? 0) - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
            </>
          ) : (
            <Bar
              dataKey={config.label ?? "Value"}
              fill={config.color}
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Streak calendar ---------------- */

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
