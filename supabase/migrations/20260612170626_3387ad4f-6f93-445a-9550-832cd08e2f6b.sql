
CREATE TABLE public.funnel_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.funnel_steps(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT NOT NULL DEFAULT 'other',
  file_size BIGINT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_attachments_funnel ON public.funnel_attachments(funnel_id);
CREATE INDEX idx_funnel_attachments_step ON public.funnel_attachments(step_id);

GRANT SELECT ON public.funnel_attachments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funnel_attachments TO authenticated;
GRANT ALL ON public.funnel_attachments TO service_role;

ALTER TABLE public.funnel_attachments ENABLE ROW LEVEL SECURITY;

-- Public can read attachments of published funnels
CREATE POLICY "Public read attachments of published funnels"
  ON public.funnel_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.funnels f
      WHERE f.id = funnel_attachments.funnel_id AND f.is_published = true
    )
  );

-- Owners can manage their attachments
CREATE POLICY "Owners manage their attachments"
  ON public.funnel_attachments FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER update_funnel_attachments_updated_at
  BEFORE UPDATE ON public.funnel_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
