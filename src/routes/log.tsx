import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  HABITS,
  HABIT_ICONS,
  CUSTOM_HABIT_OPTION,
  habitNoteColors,
  todayISO,
  useCustomHabits,
  type Habit,
} from "@/lib/habits";
import { toast } from "sonner";

interface CustomFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  placeholder?: string;
}

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

interface LogSearch {
  habit?: string;
}

export const Route = createFileRoute("/log")({
  validateSearch: (s: Record<string, unknown>): LogSearch => ({
    habit: typeof s.habit === "string" && s.habit.length > 0 ? s.habit : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Log Today — StreakUp" },
      { name: "description", content: "Log today's habits and notes." },
    ],
  }),
  component: LogPage,
});

function LogPage() {
  return (
    <AppShell>
      <LogContent />
    </AppShell>
  );
}

function LogContent() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const { allHabits, reload: reloadCustom } = useCustomHabits();
  const [habit, setHabit] = React.useState<string>(search.habit ?? "DSA & Coding");
  const [topic, setTopic] = React.useState("");
  const [questions, setQuestions] = React.useState<number>(0);
  const [easy, setEasy] = React.useState(false);
  const [medium, setMedium] = React.useState(false);
  const [hard, setHard] = React.useState(false);
  const [bookTitle, setBookTitle] = React.useState("");
  const [pages, setPages] = React.useState<number>(0);
  const [chapter, setChapter] = React.useState("");
  const [workoutType, setWorkoutType] = React.useState("");
  const [duration, setDuration] = React.useState<number>(0);
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Custom-habit flow
  const [customNameInput, setCustomNameInput] = React.useState("");
  const [customFields, setCustomFields] = React.useState<CustomFieldDef[] | null>(null);
  const [customValues, setCustomValues] = React.useState<Record<string, string>>({});
  const [loadingFields, setLoadingFields] = React.useState(false);
  const fieldsCache = React.useRef<Record<string, CustomFieldDef[]>>({});

  const isDefaultHabit = (HABITS as readonly string[]).includes(habit);
  const isCustomSentinel = habit === CUSTOM_HABIT_OPTION;
  const isExistingCustomHabit = !isDefaultHabit && !isCustomSentinel;

  // When an existing custom habit is selected, fetch AI-generated fields (cached per name)
  React.useEffect(() => {
    if (!isExistingCustomHabit) {
      setCustomFields(null);
      return;
    }
    const cached = fieldsCache.current[habit];
    if (cached) {
      setCustomFields(cached);
      setCustomValues({});
      return;
    }
    let cancelled = false;
    setLoadingFields(true);
    setCustomFields(null);
    supabase.functions
      .invoke("generate-habit-fields", { body: { habit_name: habit } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.fields) {
          toast.error("Couldn't generate fields. Using a generic form.");
          const fallback: CustomFieldDef[] = [
            { key: "what", label: "What did you do?", type: "text" },
            { key: "duration", label: "Duration / amount", type: "text" },
          ];
          fieldsCache.current[habit] = fallback;
          setCustomFields(fallback);
        } else {
          fieldsCache.current[habit] = data.fields;
          setCustomFields(data.fields);
        }
        setCustomValues({});
      })
      .finally(() => {
        if (!cancelled) setLoadingFields(false);
      });
    return () => {
      cancelled = true;
    };
  }, [habit, isExistingCustomHabit]);

  const [todayNotes, setTodayNotes] = React.useState<LogRow[]>([]);

  const loadTodayNotes = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayISO())
      .not("note", "is", null)
      .order("created_at", { ascending: false });
    setTodayNotes(((data ?? []) as LogRow[]).filter((r) => r.note && r.note.trim() !== ""));
  }, [user]);

  React.useEffect(() => {
    loadTodayNotes();
  }, [loadTodayNotes]);

  const reset = () => {
    setTopic("");
    setQuestions(0);
    setEasy(false);
    setMedium(false);
    setHard(false);
    setBookTitle("");
    setPages(0);
    setChapter("");
    setWorkoutType("");
    setDuration(0);
    setDescription("");
    setAmount("");
    setNote("");
    setCustomValues({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // If user is on the "Custom Habit" sentinel, create the habit first then redirect into it.
    if (isCustomSentinel) {
      const trimmed = customNameInput.trim();
      if (!trimmed) {
        toast.error("Please name your habit first.");
        return;
      }
      setBusy(true);
      const res = await import("@/lib/habits").then((m) =>
        m.addCustomHabit(user.id, trimmed),
      );
      setBusy(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      await reloadCustom();
      setHabit(res.name!);
      setCustomNameInput("");
      toast.success(`Added "${res.name}" — fill in today's log below.`);
      return;
    }

    setBusy(true);

    // Build per-habit payload
    const payload: Record<string, unknown> = {
      user_id: user.id,
      habit,
      date: todayISO(),
      note: note.trim() || null,
    };

    if (habit === "DSA & Coding" || habit === "Career & Projects") {
      const total = questions || 0;
      const flagsCount = [easy, medium, hard].filter(Boolean).length || 1;
      const per = Math.floor(total / flagsCount);
      const remainder = total - per * flagsCount;
      let qe = 0,
        qm = 0,
        qh = 0;
      const buckets: ("e" | "m" | "h")[] = [];
      if (easy) buckets.push("e");
      if (medium) buckets.push("m");
      if (hard) buckets.push("h");
      if (buckets.length === 0) {
        qe = total;
      } else {
        buckets.forEach((b, i) => {
          const v = per + (i < remainder ? 1 : 0);
          if (b === "e") qe += v;
          if (b === "m") qm += v;
          if (b === "h") qh += v;
        });
      }
      payload.topic = topic.trim() || null;
      payload.questions_easy = qe;
      payload.questions_medium = qm;
      payload.questions_hard = qh;
    } else if (habit === "Reading a Book") {
      payload.topic = bookTitle.trim() || null;
      payload.pages = pages || null;
      payload.description = chapter.trim() ? `Chapter: ${chapter.trim()}` : null;
    } else if (habit === "Exercise & Workout") {
      payload.topic = workoutType.trim() || null;
      payload.duration = duration || null;
    } else if (isExistingCustomHabit && customFields) {
      // Map AI-generated fields into existing log columns:
      //   - first numeric field → duration (or pages if label mentions "page")
      //   - first text/textarea field → topic
      //   - remaining fields serialized into description as "Label: value" lines
      const lines: string[] = [];
      let topicSet = false;
      let durationSet = false;
      let pagesSet = false;
      for (const f of customFields) {
        const raw = (customValues[f.key] ?? "").trim();
        if (!raw) continue;
        if (f.type === "number") {
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) {
            if (!pagesSet && /page/i.test(f.label)) {
              payload.pages = n;
              pagesSet = true;
              continue;
            }
            if (!durationSet) {
              payload.duration = n;
              durationSet = true;
              continue;
            }
          }
          lines.push(`${f.label}: ${raw}`);
        } else if (!topicSet) {
          payload.topic = raw;
          topicSet = true;
        } else {
          lines.push(`${f.label}: ${raw}`);
        }
      }
      if (lines.length > 0) payload.description = lines.join("\n");
    } else {
      payload.description = description.trim() || null;
      payload.topic = amount.trim() || null;
    }

    const { error } = await supabase.from("logs").insert(payload as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Today's log saved!");
    reset();
    loadTodayNotes();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-bold text-foreground">Log Today</h1>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Habit</Label>
            <Select value={habit} onValueChange={(v) => setHabit(v as Habit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HABITS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(habit === "DSA & Coding" || habit === "Career & Projects") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic / Concept learned</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Binary Search Trees"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qsolved">Questions solved</Label>
                <Input
                  id="qsolved"
                  type="number"
                  min={0}
                  value={questions}
                  onChange={(e) => setQuestions(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <div className="flex flex-wrap gap-2">
                  <DifficultyToggle
                    label="Easy"
                    color="var(--streak-easy)"
                    active={easy}
                    onToggle={() => setEasy((v) => !v)}
                  />
                  <DifficultyToggle
                    label="Medium"
                    color="var(--streak-medium)"
                    active={medium}
                    onToggle={() => setMedium((v) => !v)}
                  />
                  <DifficultyToggle
                    label="Hard"
                    color="var(--streak-hard)"
                    active={hard}
                    onToggle={() => setHard((v) => !v)}
                  />
                </div>
              </div>
            </>
          )}

          {habit === "Reading a Book" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="book">Book title</Label>
                <Input id="book" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Pages read today</Label>
                <Input
                  id="pages"
                  type="number"
                  min={0}
                  value={pages}
                  onChange={(e) => setPages(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chapter">Chapter reached</Label>
                <Input
                  id="chapter"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                />
              </div>
            </>
          )}

          {habit === "Exercise & Workout" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="wtype">Type of workout</Label>
                <Input
                  id="wtype"
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  placeholder="e.g. Push day, Running"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dur">Duration (minutes)</Label>
                <Input
                  id="dur"
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value || "0", 10))}
                />
              </div>
            </>
          )}

          {habit !== "DSA & Coding" &&
            habit !== "Career & Projects" &&
            habit !== "Reading a Book" &&
            habit !== "Exercise & Workout" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Duration / Amount</Label>
                  <Input
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 20 min, 2L, 8h"
                  />
                </div>
              </>
            )}

          <div className="space-y-2">
            <Label htmlFor="note">Quick note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any key takeaways or reflections…"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save today's log"}
          </Button>
        </form>
      </Card>

      {/* Pinned notes today */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Notes pinned today</h2>
        {todayNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes today yet. Add a quick note when logging to pin it here.
          </p>
        ) : (
          <ul className="space-y-3">
            {todayNotes.map((n) => (
              <NoteCard key={n.id} log={n} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DifficultyToggle({
  label,
  color,
  active,
  onToggle,
}: {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-transparent text-white"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  );
}

export function NoteCard({ log }: { log: LogRow }) {
  const colors = habitNoteColors(log.habit);
  const Icon = HABIT_ICONS[log.habit as Habit] ?? HABIT_ICONS["Journaling"];
  return (
    <li
      className={`rounded-lg border border-border border-l-4 p-4 ${colors.border} ${colors.bg}`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{log.date}</span>
        <span>·</span>
        <span>{log.habit}</span>
      </div>
      {log.topic && (
        <div className="mt-1 text-sm font-semibold text-foreground">{log.topic}</div>
      )}
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{log.note}</p>
    </li>
  );
}
