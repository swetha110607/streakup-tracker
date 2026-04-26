import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  avatar_style: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Anonymous sign-in with a chosen display name. Creates/updates the profile row. */
  startWithName: (name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "name" | "avatar_url" | "avatar_style">>) => Promise<{ error?: string }>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfile = React.useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,user_id,name,avatar_url,avatar_style")
      .eq("user_id", uid)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    startWithName: async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "Please enter your name." };

      // Anonymous sign-in
      const { data, error } = await supabase.auth.signInAnonymously({
        options: { data: { name: trimmed } },
      });
      if (error) return { error: error.message };

      const uid = data.user?.id;
      if (uid) {
        // The handle_new_user trigger inserts a profile row; ensure name is set.
        // Wait briefly for trigger to commit, then upsert name to be safe.
        await new Promise((r) => setTimeout(r, 150));
        await supabase
          .from("profiles")
          .upsert({ user_id: uid, name: trimmed }, { onConflict: "user_id" });
        await loadProfile(uid);
      }
      return {};
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshProfile: async () => {
      if (user) await loadProfile(user.id);
    },
    updateProfile: async (patch) => {
      if (!user) return { error: "Not signed in." };
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id);
      if (error) return { error: error.message };
      await loadProfile(user.id);
      return {};
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** 6 preset avatar styles using design tokens. */
export const AVATAR_STYLES: { id: string; bg: string; fg: string }[] = [
  { id: "purple", bg: "var(--primary)", fg: "white" },
  { id: "teal", bg: "var(--streak-teal)", fg: "white" },
  { id: "amber", bg: "var(--streak-medium)", fg: "white" },
  { id: "green", bg: "var(--streak-easy)", fg: "white" },
  { id: "blue", bg: "var(--streak-blue)", fg: "white" },
  { id: "pink", bg: "var(--streak-pink)", fg: "white" },
];

export function avatarStyleById(id: string | null | undefined) {
  return AVATAR_STYLES.find((s) => s.id === id) ?? AVATAR_STYLES[0];
}

export function getInitials(name: string | null | undefined): string {
  const v = (name || "U").trim();
  return v
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
