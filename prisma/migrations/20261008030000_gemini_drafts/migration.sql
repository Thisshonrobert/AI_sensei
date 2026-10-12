ALTER TABLE generation_runs DROP CONSTRAINT generation_runs_provider_check;
ALTER TABLE generation_runs ADD CONSTRAINT generation_runs_provider_check CHECK (provider IN ('manual-import','gemini'));
