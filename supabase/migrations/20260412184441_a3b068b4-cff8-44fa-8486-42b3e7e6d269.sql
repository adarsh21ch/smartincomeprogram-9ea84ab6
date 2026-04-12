CREATE UNIQUE INDEX IF NOT EXISTS idx_step_progress_session_unique 
ON public.funnel_step_progress (funnel_id, funnel_step_id, session_id) 
WHERE session_id IS NOT NULL;