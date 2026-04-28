import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, Check, Sun, Moon, BarChart3, NotebookPen, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useAuth,
  AVATAR_STYLES,
  avatarStyleById,
  getInitials,
} from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { BADGES, evaluateBadges } from "@/lib/badges";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — StreakUp" },
      { name: "description", content: "Edit your name and profile picture." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}

function ProfileContent() {
  const { user, profile, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = React.useState(profile?.name ?? "");
  const [styleId, setStyleId] = React.useState<string>(profile?.avatar_style ?? "purple");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(profile?.avatar_url ?? null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  // Sync if profile loads after mount
  React.useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setStyleId(profile.avatar_style ?? "purple");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

  const initials = getInitials(name);
  const previewStyle = avatarStyleById(styleId);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please pick an image under 2MB.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast.success("Picture uploaded — don't forget to save changes.");
  };

  const handleRemovePicture = () => {
    setAvatarUrl(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name can't be empty.");
      return;
    }
    setBusy(true);
    const { error } = await updateProfile({
      name: name.trim(),
      avatar_style: styleId,
      avatar_url: avatarUrl,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Profile updated!");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      <Card className="p-6">
        {/* Preview */}
        <div className="mb-6 flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Your avatar"
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold"
              style={{ backgroundColor: previewStyle.bg, color: previewStyle.fg }}
            >
              {initials}
            </span>
          )}
          <div>
            <div className="text-base font-semibold text-foreground">
              {name || "Your name"}
            </div>
            <div className="text-xs text-muted-foreground">
              How you'll appear in StreakUp
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Preset colors */}
          <div className="space-y-2">
            <Label>Pick an avatar color</Label>
            <div className="flex flex-wrap gap-3">
              {AVATAR_STYLES.map((s) => {
                const active = styleId === s.id && !avatarUrl;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStyleId(s.id);
                      setAvatarUrl(null);
                    }}
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold transition-transform hover:scale-105 ${
                      active ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                    }`}
                    style={{ backgroundColor: s.bg, color: s.fg }}
                    aria-label={`Avatar color ${s.id}`}
                  >
                    {initials}
                    {active && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload */}
          <div className="space-y-2">
            <Label>Or upload a profile picture</Label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading…" : avatarUrl ? "Replace picture" : "Upload picture"}
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" onClick={handleRemovePicture}>
                  Remove picture
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG or JPG, up to 2MB.</p>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Appearance</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </span>
            <div>
              <Label htmlFor="dark-mode" className="text-base font-medium">
                Dark Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Switch between light and dark theme.
              </p>
            </div>
          </div>
          <Switch
            id="dark-mode"
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
      </Card>

      <BadgesSection />
    </div>
  );
}

const EARNED_BADGES_STORAGE_KEY = "streakup-earned-badges";

function BadgesSection() {
  const { user } = useAuth();
  const [earned, setEarned] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const result = await evaluateBadges(user.id);
      if (cancelled) return;

      // Compare with previously seen badges to detect newly earned ones
      try {
        const raw = localStorage.getItem(`${EARNED_BADGES_STORAGE_KEY}-${user.id}`);
        const prev = new Set<string>(raw ? JSON.parse(raw) : []);
        const newly = [...result].filter((id) => !prev.has(id));
        if (newly.length > 0 && prev.size > 0) {
          // Only celebrate after the first load (prev.size > 0 ensures we don't spam on first ever visit)
          newly.forEach((id) => {
            const b = BADGES.find((x) => x.id === id);
            if (b) toast.success(`🎉 New badge unlocked: ${b.emoji} ${b.name}`);
          });
        }
        localStorage.setItem(
          `${EARNED_BADGES_STORAGE_KEY}-${user.id}`,
          JSON.stringify([...result]),
        );
      } catch {
        /* ignore storage errors */
      }

      setEarned(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">Milestone Badges</h2>
        <span className="text-xs text-muted-foreground">
          {loading ? "…" : `${earned.size} / ${BADGES.length} earned`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {BADGES.map((b) => {
          const isEarned = earned.has(b.id);
          const glowColor =
            b.glow === "primary" ? "var(--primary)" : "var(--streak-teal)";
          return (
            <div
              key={b.id}
              className={`relative flex flex-col items-center rounded-xl border p-4 text-center transition-all ${
                isEarned
                  ? "border-border bg-card"
                  : "border-border/60 bg-muted/40 opacity-60"
              }`}
              style={
                isEarned
                  ? {
                      boxShadow: `0 0 0 1px color-mix(in oklab, ${glowColor} 35%, transparent), 0 8px 24px -8px color-mix(in oklab, ${glowColor} 50%, transparent)`,
                    }
                  : undefined
              }
            >
              <div
                className={`mb-2 text-4xl ${isEarned ? "" : "grayscale blur-[1px]"}`}
                aria-hidden
              >
                {b.emoji}
              </div>
              <div
                className={`text-sm font-semibold ${
                  isEarned ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {b.name}
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {b.description}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
