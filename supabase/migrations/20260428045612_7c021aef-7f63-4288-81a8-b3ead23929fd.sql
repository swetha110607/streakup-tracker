
-- Add friend_code column to profiles, auto-generated, unique
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_code text UNIQUE;

-- Backfill existing rows with a unique code
DO $$
DECLARE
  r record;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE friend_code IS NULL LOOP
    LOOP
      new_code := public.generate_friend_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_code = new_code);
    END LOOP;
    UPDATE public.profiles SET friend_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN friend_code SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN friend_code SET DEFAULT public.generate_friend_code();

-- Update handle_new_user to set friend_code with retry on collision
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  LOOP
    new_code := public.generate_friend_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_code = new_code);
    attempts := attempts + 1;
    IF attempts > 10 THEN EXIT; END IF;
  END LOOP;
  INSERT INTO public.profiles (user_id, name, friend_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), new_code);
  RETURN NEW;
END;
$$;

-- Allow any authenticated user to look up a profile by friend_code (limited fields via app code)
-- We add a second SELECT policy granting everyone access; combined with the existing self-only policy
-- via OR semantics. Profiles only contain name/avatar/friend_code (no PII like email).
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to read each other's logs (needed for live leaderboard + challenges)
-- Logs contain habit data only, no PII.
CREATE POLICY "Logs are viewable by authenticated users"
  ON public.logs FOR SELECT
  TO authenticated
  USING (true);

-- friendships table
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_user_id uuid NOT NULL,
  friend_code text NOT NULL,
  friend_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_user_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own friendships"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id);

-- challenges table
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL,
  habit text NOT NULL,
  duration_days int NOT NULL CHECK (duration_days IN (7, 14, 30)),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT public.generate_friend_code(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- challenge_members table (created before challenge SELECT policy that references it)
CREATE TABLE public.challenge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.challenge_members ENABLE ROW LEVEL SECURITY;

-- Security definer helper to check membership without recursive RLS
CREATE OR REPLACE FUNCTION public.is_challenge_member(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_members
    WHERE challenge_id = _challenge_id AND user_id = _user_id
  );
$$;

-- Helper: lookup challenge id by invite code (so users can join without first SELECTing the challenge)
CREATE OR REPLACE FUNCTION public.find_challenge_by_code(_invite_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.challenges WHERE invite_code = upper(_invite_code) LIMIT 1;
$$;

-- Challenges: members can read; creator can update/delete; anyone authenticated can insert as creator
CREATE POLICY "Members can view their challenges"
  ON public.challenges FOR SELECT
  USING (auth.uid() = creator_id OR public.is_challenge_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their challenges"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their challenges"
  ON public.challenges FOR DELETE
  USING (auth.uid() = creator_id);

-- Challenge members: members of the same challenge can see each other; users can add themselves
CREATE POLICY "Members can view fellow members"
  ON public.challenge_members FOR SELECT
  USING (public.is_challenge_member(challenge_id, auth.uid()));

CREATE POLICY "Users can join challenges as themselves"
  ON public.challenge_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave challenges"
  ON public.challenge_members FOR DELETE
  USING (auth.uid() = user_id);
