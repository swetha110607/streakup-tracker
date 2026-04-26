import {
  Code2,
  BookOpen,
  Dumbbell,
  Brain,
  Droplets,
  Languages,
  PenLine,
  Music,
  Apple,
  Moon,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export const HABITS = [
  "DSA & Coding",
  "Reading a Book",
  "Exercise & Workout",
  "Meditation",
  "Water Intake",
  "Language Learning",
  "Journaling",
  "Music Practice",
  "Nutrition & Diet",
  "Sleep Tracking",
  "Career & Projects",
] as const;

export type Habit = (typeof HABITS)[number];

export const HABIT_ICONS: Record<Habit, LucideIcon> = {
  "DSA & Coding": Code2,
  "Reading a Book": BookOpen,
  "Exercise & Workout": Dumbbell,
  Meditation: Brain,
  "Water Intake": Droplets,
  "Language Learning": Languages,
  Journaling: PenLine,
  "Music Practice": Music,
  "Nutrition & Diet": Apple,
  "Sleep Tracking": Moon,
  "Career & Projects": Briefcase,
};

// Returns Tailwind classes for note card border and background per habit
export function habitNoteColors(habit: string): { border: string; bg: string; dot: string } {
  if (habit === "DSA & Coding") {
    return { border: "border-l-primary", bg: "bg-primary/5", dot: "bg-primary" };
  }
  if (habit === "Reading a Book") {
    return {
      border: "border-l-[var(--streak-teal)]",
      bg: "bg-[color-mix(in_oklab,var(--streak-teal)_8%,transparent)]",
      dot: "bg-[var(--streak-teal)]",
    };
  }
  if (habit === "Exercise & Workout") {
    return {
      border: "border-l-[var(--streak-medium)]",
      bg: "bg-[color-mix(in_oklab,var(--streak-medium)_10%,transparent)]",
      dot: "bg-[var(--streak-medium)]",
    };
  }
  if (habit === "Career & Projects") {
    return {
      border: "border-l-[var(--streak-blue)]",
      bg: "bg-[color-mix(in_oklab,var(--streak-blue)_10%,transparent)]",
      dot: "bg-[var(--streak-blue)]",
    };
  }
  return {
    border: "border-l-[var(--streak-pink)]",
    bg: "bg-[color-mix(in_oklab,var(--streak-pink)_12%,transparent)]",
    dot: "bg-[var(--streak-pink)]",
  };
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calculate current consecutive-day streak (including today) given an array of YYYY-MM-DD date strings. */
export function calcStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date();
  // If today not logged, streak from yesterday is allowed only if today not yet logged?
  // Spec: consecutive days including today where at least one log exists. If today missing, streak is 0.
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    if (set.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
