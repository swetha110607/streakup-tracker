import { supabase } from "@/integrations/supabase/client";
import { calcStreak } from "@/lib/habits";

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Glow color token */
  glow: "primary" | "teal";
}

export const BADGES: Badge[] = [
  { id: "first_step", name: "First Step", emoji: "🌱", description: "Logged your very first habit.", glow: "teal" },
  { id: "week_warrior", name: "Week Warrior", emoji: "🥉", description: "Reached a 7-day streak on any habit.", glow: "primary" },
  { id: "streak_master", name: "Streak Master", emoji: "🥈", description: "Reached a 30-day streak on any habit.", glow: "primary" },
  { id: "century_club", name: "Century Club", emoji: "🏆", description: "Reached a 100-day streak — incredible!", glow: "primary" },
  { id: "note_taker", name: "Note Taker", emoji: "📝", description: "Saved 10 notes across your habits.", glow: "teal" },
  { id: "habit_collector", name: "Habit Collector", emoji: "🎯", description: "Tracked 3 or more different habits.", glow: "teal" },
  { id: "question_crusher", name: "Question Crusher", emoji: "💻", description: "Solved 100 DSA questions in total.", glow: "primary" },
  { id: "consistency_king", name: "Consistency King", emoji: "👑", description: "Logged any habit 14 days in a row.", glow: "primary" },
];

interface LogRow {
  habit: string;
  date: string;
  note: string | null;
  questions_easy: number;
  questions_medium: number;
  questions_hard: number;
}

export async function evaluateBadges(userId: string): Promise<Set<string>> {
  const earned = new Set<string>();
  const { data } = await supabase
    .from("logs")
    .select("habit,date,note,questions_easy,questions_medium,questions_hard")
    .eq("user_id", userId);
  const logs = (data ?? []) as LogRow[];
  if (logs.length === 0) return earned;

  // First Step
  earned.add("first_step");

  // Note Taker
  const noteCount = logs.filter((l) => l.note && l.note.trim().length > 0).length;
  if (noteCount >= 10) earned.add("note_taker");

  // Habit Collector
  const habitSet = new Set(logs.map((l) => l.habit));
  if (habitSet.size >= 3) earned.add("habit_collector");

  // Question Crusher
  const totalQ = logs.reduce(
    (sum, l) => sum + (l.questions_easy || 0) + (l.questions_medium || 0) + (l.questions_hard || 0),
    0,
  );
  if (totalQ >= 100) earned.add("question_crusher");

  // Per-habit streaks
  const byHabit = new Map<string, string[]>();
  for (const l of logs) {
    if (!byHabit.has(l.habit)) byHabit.set(l.habit, []);
    byHabit.get(l.habit)!.push(l.date);
  }
  let maxHabitStreak = 0;
  for (const dates of byHabit.values()) {
    const s = calcStreak(dates);
    if (s > maxHabitStreak) maxHabitStreak = s;
  }
  if (maxHabitStreak >= 7) earned.add("week_warrior");
  if (maxHabitStreak >= 30) earned.add("streak_master");
  if (maxHabitStreak >= 100) earned.add("century_club");

  // Consistency King — any-habit 14-day streak (union of all log dates)
  const allDates = Array.from(new Set(logs.map((l) => l.date)));
  const anyStreak = calcStreak(allDates);
  if (anyStreak >= 14) earned.add("consistency_king");

  return earned;
}
