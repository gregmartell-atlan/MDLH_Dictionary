-- Evaluation Database Schema
-- SQLite DDL for runs, scores, gaps, plans, artifacts

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  scope_json TEXT,
  capabilities_json TEXT,
  scoring_config_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Catalog (ingested assets)
CREATE TABLE IF NOT EXISTS catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  asset_name TEXT,
  asset_type TEXT,
  qualified_name TEXT,
  connector_name TEXT,
  attributes_json TEXT,
  UNIQUE(run_id, guid)
);

-- Scores
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT,
  asset_type TEXT,
  qualified_name TEXT,
  impact_score REAL,
  quality_score REAL,
  quality_unknown INTEGER DEFAULT 0,
  quadrant TEXT,
  explanations_json TEXT,
  UNIQUE(run_id, subject_id)
);

-- Gaps
CREATE TABLE IF NOT EXISTS gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  asset_type TEXT,
  current_coverage REAL,
  target_coverage REAL,
  gap_percent REAL,
  priority TEXT,
  effort_hours REAL
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  phases_json TEXT,
  total_weeks INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  format TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_catalog_run ON catalog(run_id);
CREATE INDEX IF NOT EXISTS idx_catalog_type ON catalog(asset_type);
CREATE INDEX IF NOT EXISTS idx_scores_run ON scores(run_id);
CREATE INDEX IF NOT EXISTS idx_scores_quadrant ON scores(quadrant);
CREATE INDEX IF NOT EXISTS idx_gaps_run ON gaps(run_id);
CREATE INDEX IF NOT EXISTS idx_gaps_priority ON gaps(priority);
CREATE INDEX IF NOT EXISTS idx_plans_run ON plans(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
