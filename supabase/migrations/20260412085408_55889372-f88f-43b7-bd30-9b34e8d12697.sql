-- Add permanently_unlocked column to funnel_step_progress
ALTER TABLE public.funnel_step_progress
  ADD COLUMN IF NOT EXISTS permanently_unlocked boolean DEFAULT false;

-- Retroactively mark all completed steps as permanently unlocked
UPDATE public.funnel_step_progress
SET permanently_unlocked = true
WHERE status = 'completed';