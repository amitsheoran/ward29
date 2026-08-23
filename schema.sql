-- ==========================================================================
-- WARD 29 COMMUNITY POLL - SUPABASE SCHEMA & ROW LEVEL SECURITY
-- ==========================================================================

-- 1. Candidates Table
CREATE TABLE IF NOT EXISTS public.candidates (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.candidates (id, name, relation) VALUES
(1, 'Monika Baloda', 'W/O Manish Baloda'),
(2, 'Aditi Godara', 'W/O Amardeep Godara'),
(3, 'Poonam Sihag', 'W/O Anil Sihag'),
(4, 'Suman', 'W/O Tilak'),
(5, 'Aruna Madam', 'W/O Bhupendra Sheoran')
ON CONFLICT (id) DO NOTHING;

-- 2. Votes Table (One vote per user/session)
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id INT NOT NULL REFERENCES public.candidates(id),
    session_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow anyone to read candidates
CREATE POLICY "Allow public read access to candidates"
ON public.candidates FOR SELECT
USING (true);

-- Allow anyone to read aggregate votes
CREATE POLICY "Allow public read access to votes"
ON public.votes FOR SELECT
USING (true);

-- Allow anonymous users to insert their single vote
CREATE POLICY "Allow anonymous vote submission"
ON public.votes FOR INSERT
WITH CHECK (
    NOT EXISTS (
        SELECT 1 FROM public.votes
        WHERE votes.session_id = current_setting('request.headers', true)::json->>'x-session-id'
           OR votes.session_id = auth.uid()::text
    )
);

-- 5. Enable Supabase Realtime for live broadcasting
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
