import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { useCustomHabits, CUSTOM_HABIT_OPTION } from "@/lib/habits";
import { NoteCard } from "@/routes/log";

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

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — StreakUp" },
      { name: "description", content: "All your habit notes in one place." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  return (
    <AppShell>
      <NotesContent />
    </AppShell>
  );
}

function NotesContent() {
  const { user } = useAuth();
  const { allHabits } = useCustomHabits();
  const [notes, setNotes] = React.useState<LogRow[]>([]);
  const [filter, setFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", user.id)
        .not("note", "is", null)
        .order("created_at", { ascending: false });
      setNotes(((data ?? []) as LogRow[]).filter((r) => r.note && r.note.trim() !== ""));
      setLoading(false);
    })();
  }, [user]);

  const filtered = filter === "all" ? notes : notes.filter((n) => n.habit === filter);

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">All notes</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All habits</SelectItem>
            {allHabits
              .filter((h) => h !== CUSTOM_HABIT_OPTION)
              .map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No notes yet. Notes you add when logging will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => (
            <NoteCard key={n.id} log={n} />
          ))}
        </ul>
      )}
    </Card>
  );
}
