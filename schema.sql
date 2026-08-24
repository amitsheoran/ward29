-- ==========================================================================
-- WARD 29 COMMUNITY POLL - SUPABASE SCHEMA
-- Anonymous one-vote-per-browser/device (best-effort). Not one-human-one-vote.
-- Run this entire script in the Supabase SQL Editor (service role / dashboard).
-- ==========================================================================

-- 1. Candidates
CREATE TABLE IF NOT EXISTS public.candidates (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.candidates
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO public.candidates (id, name, relation, is_active) VALUES
(1, 'Monika Baloda', 'W/O Manish Baloda', TRUE),
(2, 'Aditi Godara', 'W/O Amardeep Godara', TRUE),
(3, 'Poonam Sihag', 'W/O Anil Sihag', TRUE),
(4, 'Suman', 'W/O Tilak', TRUE),
(5, 'Aruna Madam', 'W/O Bhupendra Sheoran', TRUE),
(6, 'Deepa', 'D/o/L Tarachand Saini', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    relation = EXCLUDED.relation,
    is_active = TRUE;

-- 2. Preserve any older session_id votes table (do not drop historical rows)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'votes'
          AND column_name = 'session_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'votes'
          AND column_name = 'device_hash'
    ) THEN
        ALTER TABLE public.votes RENAME TO votes_legacy_session;
    END IF;
END $$;

-- 3. Anonymous votes: store SHA-256 hex only (never the raw token)
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id INT NOT NULL REFERENCES public.candidates(id),
    device_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT votes_device_hash_unique UNIQUE (device_hash),
    CONSTRAINT votes_device_hash_sha256 CHECK (device_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS votes_candidate_id_idx ON public.votes (candidate_id);

-- 4. Public aggregate counts (no hashes). Source of live results.
CREATE TABLE IF NOT EXISTS public.candidate_votes (
    candidate_id INT PRIMARY KEY REFERENCES public.candidates(id),
    count INT NOT NULL DEFAULT 0 CHECK (count >= 0)
);

INSERT INTO public.candidate_votes (candidate_id, count)
SELECT id, 0 FROM public.candidates
ON CONFLICT (candidate_id) DO NOTHING;

-- 5. RLS: public clients cannot read hashes or insert votes directly
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to candidates" ON public.candidates;
DROP POLICY IF EXISTS "Allow public read access to votes" ON public.votes;
DROP POLICY IF EXISTS "Allow anonymous vote submission" ON public.votes;
DROP POLICY IF EXISTS "candidates_public_read" ON public.candidates;
DROP POLICY IF EXISTS "votes_no_direct_client_access" ON public.votes;
DROP POLICY IF EXISTS "candidate_votes_public_read" ON public.candidate_votes;

CREATE POLICY "candidates_public_read"
ON public.candidates FOR SELECT
USING (true);

CREATE POLICY "candidate_votes_public_read"
ON public.candidate_votes FOR SELECT
USING (true);

-- No SELECT/INSERT/UPDATE/DELETE policies on votes for anon/authenticated.
-- All writes go through submit_vote (SECURITY DEFINER).

REVOKE ALL ON TABLE public.votes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.candidates TO anon, authenticated;
GRANT SELECT ON TABLE public.candidate_votes TO anon, authenticated;

-- 6. Atomic vote: INSERT + UNIQUE(device_hash) in one transaction
CREATE OR REPLACE FUNCTION public.submit_vote(p_candidate_id INT, p_device_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted UUID;
    v_existing_candidate INT;
BEGIN
    IF p_device_hash IS NULL OR p_device_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'status', 'invalid');
    END IF;

    IF p_candidate_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.candidates
        WHERE id = p_candidate_id AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('ok', false, 'status', 'invalid_candidate');
    END IF;

    INSERT INTO public.votes (candidate_id, device_hash)
    VALUES (p_candidate_id, p_device_hash)
    ON CONFLICT (device_hash) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NULL THEN
        SELECT candidate_id INTO v_existing_candidate
        FROM public.votes
        WHERE device_hash = p_device_hash;

        RETURN jsonb_build_object(
            'ok', false,
            'status', 'already_voted',
            'candidate_id', v_existing_candidate
        );
    END IF;

    INSERT INTO public.candidate_votes (candidate_id, count)
    VALUES (p_candidate_id, 1)
    ON CONFLICT (candidate_id)
    DO UPDATE SET count = public.candidate_votes.count + 1;

    RETURN jsonb_build_object(
        'ok', true,
        'status', 'recorded',
        'candidate_id', p_candidate_id
    );
EXCEPTION
    WHEN unique_violation THEN
        SELECT candidate_id INTO v_existing_candidate
        FROM public.votes
        WHERE device_hash = p_device_hash;

        RETURN jsonb_build_object(
            'ok', false,
            'status', 'already_voted',
            'candidate_id', v_existing_candidate
        );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vote_status(p_device_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_candidate_id INT;
BEGIN
    IF p_device_hash IS NULL OR p_device_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN jsonb_build_object('voted', false);
    END IF;

    SELECT candidate_id INTO v_candidate_id
    FROM public.votes
    WHERE device_hash = p_device_hash;

    IF v_candidate_id IS NULL THEN
        RETURN jsonb_build_object('voted', false);
    END IF;

    RETURN jsonb_build_object(
        'voted', true,
        'candidate_id', v_candidate_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_vote(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vote_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vote(INT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_status(TEXT) TO anon, authenticated;

-- 7. Realtime for live aggregate counts only
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_votes;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
