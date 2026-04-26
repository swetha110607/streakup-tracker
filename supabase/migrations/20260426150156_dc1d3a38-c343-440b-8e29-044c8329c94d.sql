CREATE TABLE public.custom_habits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  habit_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom habits"
ON public.custom_habits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom habits"
ON public.custom_habits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom habits"
ON public.custom_habits FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom habits"
ON public.custom_habits FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_custom_habits_user_id ON public.custom_habits(user_id);