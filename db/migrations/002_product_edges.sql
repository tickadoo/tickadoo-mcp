BEGIN;

CREATE TABLE IF NOT EXISTS product_edges (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('tag_overlap','spatial','temporal','similar','co_booked')),
  strength REAL NOT NULL CHECK (strength >= 0 AND strength <= 1),
  metadata JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_source_type_strength
  ON product_edges (source_id, edge_type, strength DESC);

CREATE INDEX IF NOT EXISTS idx_edges_target_type
  ON product_edges (target_id, edge_type);

COMMIT;
