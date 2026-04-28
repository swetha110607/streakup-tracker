import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, UserPlus, Flame, Trophy, Plus, Users, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { HABITS, calcStreak, todayISO } from "@/lib/habits";
import { toast } from "sonner";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — StreakUp" },
      { name: "description", content: "Compete with friends on streaks and challenges." },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  return (
    <AppShell>
      <FriendsContent />
    </AppShell>
  );
}

interface ProfileLite {
  user_id: string;
  name: string | null;
  friend_code: string;
}

interface LeaderRow {
  user_id: string;
  name: string;
  topHabit: string;
  streak: number;
  isMe: boolean;
}

interface ChallengeRow {
  id: string;
  creator_id: string;
  title: string;
  habit: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  invite_code: string;
}

interface ChallengeMember {
  user_id: string;
  user_name: string | null;
}

function FriendsContent() {
  const { user, profile } = useAuth();
  const [friendCodeInput, setFriendCodeInput] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [leaderboard, setLeaderboard] = React.useState<LeaderRow[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = React.useState(true);

  const myFriendCode = profile?.friend_code ?? "";

  const loadLeaderboard = React.useCallback(async () => {
    if (!user) return;
    setLoadingLeaderboard(true);

    // Get my friendships
    const { data: friends } = await supabase
      .from("friendships")
      .select("friend_user_id, friend_name")
      .eq("user_id", user.id);

    const friendIds = (friends ?? []).map((f) => f.friend_user_id);
    const allIds = [user.id, ...friendIds];

    // Get profiles for everyone (for fresh names)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", allIds);

    const nameById = new Map<string, string>();
    (profiles ?? []).forEach((p) => nameById.set(p.user_id, p.name || "User"));

    // Get all logs for everyone
    const { data: logs } = await supabase
      .from("logs")
      .select("user_id, habit, date")
      .in("user_id", allIds);

    // Compute longest active streak per user
    const rows: LeaderRow[] = allIds.map((uid) => {
      const userLogs = (logs ?? []).filter((l) => l.user_id === uid);
      const byHabit = new Map<string, string[]>();
      userLogs.forEach((l) => {
        if (!byHabit.has(l.habit)) byHabit.set(l.habit, []);
        byHabit.get(l.habit)!.push(l.date);
      });
      let topHabit = "—";
      let bestStreak = 0;
      for (const [habit, dates] of byHabit) {
        const s = calcStreak(dates);
        if (s > bestStreak) {
          bestStreak = s;
          topHabit = habit;
        }
      }
      return {
        user_id: uid,
        name: nameById.get(uid) || "User",
        topHabit,
        streak: bestStreak,
        isMe: uid === user.id,
      };
    });

    rows.sort((a, b) => b.streak - a.streak);
    setLeaderboard(rows);
    setLoadingLeaderboard(false);
  }, [user]);

  React.useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const copyCode = async () => {
    if (!myFriendCode) return;
    try {
      await navigator.clipboard.writeText(myFriendCode);
      toast.success("Friend code copied!");
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  };

  const handleAddFriend = async () => {
    const code = friendCodeInput.trim().toUpperCase();
    if (!user) return;
    if (code.length !== 6) {
      toast.error("Friend codes are exactly 6 characters.");
      return;
    }
    if (code === myFriendCode) {
      toast.error("That's your own code!");
      return;
    }
    setAdding(true);

    const { data: friendProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("user_id, name, friend_code")
      .eq("friend_code", code)
      .maybeSingle();

    if (lookupError || !friendProfile) {
      setAdding(false);
      toast.error("No user found with that code.");
      return;
    }

    const { error: insertError } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_user_id: friendProfile.user_id,
      friend_code: friendProfile.friend_code,
      friend_name: friendProfile.name,
    });

    setAdding(false);
    if (insertError) {
      if (insertError.code === "23505") {
        toast.error("You're already friends with them.");
      } else {
        toast.error(insertError.message);
      }
      return;
    }
    toast.success(`Added ${friendProfile.name || "friend"}!`);
    setFriendCodeInput("");
    loadLeaderboard();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Friends</h1>

      {/* Friend code */}
      <Card className="p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your Friend Code
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg bg-primary/10 px-5 py-4 text-center font-mono text-3xl font-bold tracking-[0.4em] text-primary">
            {myFriendCode || "------"}
          </div>
          <Button onClick={copyCode} variant="outline" size="lg" disabled={!myFriendCode}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Share this code with friends so they can add you.
        </p>
      </Card>

      {/* Add a friend */}
      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add a Friend
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={friendCodeInput}
            onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter 6-char code"
            maxLength={6}
            className="font-mono uppercase tracking-widest"
          />
          <Button onClick={handleAddFriend} disabled={adding}>
            <UserPlus className="mr-2 h-4 w-4" />
            {adding ? "Adding…" : "Add Friend"}
          </Button>
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Streak Leaderboard</h2>
        </div>
        {loadingLeaderboard ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((row, idx) => (
              <div
                key={row.user_id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  row.isMe
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    idx === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {row.name} {row.isMe && <span className="text-xs text-primary">(you)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{row.topHabit}</div>
                </div>
                <div className="flex items-center gap-1 font-semibold text-foreground">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {row.streak}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ChallengesSection onChange={loadLeaderboard} />
    </div>
  );
}

function ChallengesSection({ onChange: _onChange }: { onChange: () => void }) {
  const { user, profile } = useAuth();
  const [challenges, setChallenges] = React.useState<ChallengeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState("");
  const [joining, setJoining] = React.useState(false);

  const loadChallenges = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Find challenges I'm a member of
    const { data: memberships } = await supabase
      .from("challenge_members")
      .select("challenge_id")
      .eq("user_id", user.id);
    const ids = (memberships ?? []).map((m) => m.challenge_id);
    if (ids.length === 0) {
      setChallenges([]);
      setLoading(false);
      return;
    }
    const { data: rows } = await supabase
      .from("challenges")
      .select("id, creator_id, title, habit, duration_days, start_date, end_date, invite_code")
      .in("id", ids)
      .gte("end_date", todayISO())
      .order("end_date", { ascending: true });
    setChallenges((rows ?? []) as ChallengeRow[]);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!user) return;
    if (code.length !== 6) {
      toast.error("Invite codes are 6 characters.");
      return;
    }
    setJoining(true);

    const { data: challengeId, error: lookupErr } = await supabase.rpc(
      "find_challenge_by_code",
      { _invite_code: code },
    );
    if (lookupErr || !challengeId) {
      setJoining(false);
      toast.error("No challenge found with that code.");
      return;
    }

    const { error: joinErr } = await supabase.from("challenge_members").insert({
      challenge_id: challengeId,
      user_id: user.id,
      user_name: profile?.name ?? null,
    });
    setJoining(false);
    if (joinErr) {
      if (joinErr.code === "23505") toast.error("You've already joined that challenge.");
      else toast.error(joinErr.message);
      return;
    }
    toast.success("Joined challenge!");
    setJoinCode("");
    loadChallenges();
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Challenges</h2>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Challenge
            </Button>
          </DialogTrigger>
          <CreateChallengeDialog
            onCreated={() => {
              setCreateOpen(false);
              loadChallenges();
            }}
          />
        </Dialog>
      </div>

      {/* Join by code */}
      <div className="mb-5 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row">
        <Input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Join with invite code"
          maxLength={6}
          className="font-mono uppercase tracking-widest"
        />
        <Button onClick={handleJoin} disabled={joining} variant="outline">
          {joining ? "Joining…" : "Join Challenge"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading challenges…</p>
      ) : challenges.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No active challenges. Start one or join with a code!
        </p>
      ) : (
        <div className="space-y-4">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CreateChallengeDialog({ onCreated }: { onCreated: () => void }) {
  const { user, profile } = useAuth();
  const [title, setTitle] = React.useState("");
  const [habit, setHabit] = React.useState<string>(HABITS[0]);
  const [duration, setDuration] = React.useState<string>("7");
  const [busy, setBusy] = React.useState(false);

  const handleCreate = async () => {
    if (!user) return;
    const t = title.trim();
    if (!t) {
      toast.error("Please name your challenge.");
      return;
    }
    setBusy(true);
    const days = parseInt(duration, 10);
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + days - 1);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    const { data: created, error } = await supabase
      .from("challenges")
      .insert({
        creator_id: user.id,
        title: t,
        habit,
        duration_days: days,
        start_date: startISO,
        end_date: endISO,
      })
      .select("id, invite_code")
      .single();

    if (error || !created) {
      setBusy(false);
      toast.error(error?.message || "Couldn't create challenge.");
      return;
    }

    // Auto-join creator
    await supabase.from("challenge_members").insert({
      challenge_id: created.id,
      user_id: user.id,
      user_name: profile?.name ?? null,
    });

    setBusy(false);
    toast.success(`Challenge created! Invite code: ${created.invite_code}`);
    setTitle("");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New Challenge</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="ch-title">Challenge title</Label>
          <Input
            id="ch-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="30 Days of Coding"
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label>Habit to track</Label>
          <Select value={habit} onValueChange={setHabit}>
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
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleCreate} disabled={busy}>
          {busy ? "Starting…" : "Start Challenge"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ChallengeCard({ challenge }: { challenge: ChallengeRow }) {
  const { user } = useAuth();
  const [members, setMembers] = React.useState<ChallengeMember[]>([]);
  const [progress, setProgress] = React.useState<
    Map<string, { count: number; loggedToday: boolean; name: string }>
  >(new Map());
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ms } = await supabase
        .from("challenge_members")
        .select("user_id, user_name")
        .eq("challenge_id", challenge.id);
      if (cancelled) return;
      const mList = (ms ?? []) as ChallengeMember[];
      setMembers(mList);

      const ids = mList.map((m) => m.user_id);
      if (ids.length === 0) return;

      // Fresh names from profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", ids);
      const freshName = new Map<string, string>();
      (profiles ?? []).forEach((p) => freshName.set(p.user_id, p.name || "User"));

      // Logs for this habit between start_date and end_date
      const { data: logs } = await supabase
        .from("logs")
        .select("user_id, date")
        .in("user_id", ids)
        .eq("habit", challenge.habit)
        .gte("date", challenge.start_date)
        .lte("date", challenge.end_date);

      const today = todayISO();
      const map = new Map<string, { count: number; loggedToday: boolean; name: string }>();
      mList.forEach((m) => {
        map.set(m.user_id, {
          count: 0,
          loggedToday: false,
          name: freshName.get(m.user_id) || m.user_name || "User",
        });
      });
      const seenDates = new Map<string, Set<string>>(); // user -> set of dates
      (logs ?? []).forEach((l) => {
        if (!seenDates.has(l.user_id)) seenDates.set(l.user_id, new Set());
        seenDates.get(l.user_id)!.add(l.date);
      });
      seenDates.forEach((dates, uid) => {
        const entry = map.get(uid);
        if (!entry) return;
        entry.count = dates.size;
        entry.loggedToday = dates.has(today);
      });
      if (!cancelled) setProgress(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge.id, challenge.habit, challenge.start_date, challenge.end_date]);

  const today = new Date(todayISO());
  const end = new Date(challenge.end_date);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - today.getTime()) / msPerDay) + 1,
  );

  const ranked = members
    .map((m) => ({
      user_id: m.user_id,
      ...(progress.get(m.user_id) ?? { count: 0, loggedToday: false, name: m.user_name || "User" }),
    }))
    .sort((a, b) => b.count - a.count);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(challenge.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-foreground">{challenge.title}</div>
          <div className="text-xs text-muted-foreground">
            {challenge.habit} · {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left
          </div>
        </div>
        <button
          type="button"
          onClick={copyInvite}
          className="rounded-md bg-muted px-2 py-1 font-mono text-xs tracking-widest text-foreground hover:bg-muted/80"
          title="Click to copy invite code"
        >
          {copied ? "COPIED!" : challenge.invite_code}
        </button>
      </div>

      <div className="space-y-1.5">
        {ranked.map((m, idx) => {
          const isMe = m.user_id === user?.id;
          return (
            <div
              key={m.user_id}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
                isMe ? "bg-primary/10" : ""
              }`}
            >
              <span className="w-5 text-xs font-bold text-muted-foreground">{idx + 1}</span>
              <span className="flex-1 truncate text-foreground">
                {m.name} {isMe && <span className="text-xs text-primary">(you)</span>}
              </span>
              {m.loggedToday && (
                <CheckCircle2 className="h-4 w-4 text-[var(--streak-easy)]" aria-label="Logged today" />
              )}
              <span className="font-semibold text-foreground">
                {m.count}/{challenge.duration_days}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
