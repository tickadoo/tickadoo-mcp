-- Tag overlap edges via Jaccard similarity, per city.
-- Threshold strength >= 0.3, symmetric (both directions).
-- Adapted for this schema: city_slug is the city key and tags is text[].

WITH pairs AS (
  SELECT
    a.slug AS source_id,
    b.slug AS target_id,
    a.city_slug,
    ARRAY(SELECT UNNEST(a.tags) INTERSECT SELECT UNNEST(b.tags)) AS shared,
    ARRAY(SELECT UNNEST(a.tags) UNION SELECT UNNEST(b.tags)) AS combined
  FROM products a
  JOIN products b ON a.city_slug = b.city_slug AND a.slug < b.slug
  WHERE a.slug IS NOT NULL AND b.slug IS NOT NULL
    AND a.tags IS NOT NULL AND b.tags IS NOT NULL
    AND cardinality(a.tags) > 0 AND cardinality(b.tags) > 0
),
scored AS (
  SELECT source_id, target_id, city_slug,
    cardinality(shared)::real / NULLIF(cardinality(combined), 0)::real AS jaccard,
    shared
  FROM pairs
  WHERE cardinality(shared) > 0
),
deduped AS (
  SELECT DISTINCT ON (source_id, target_id)
    source_id,
    target_id,
    city_slug,
    jaccard,
    shared
  FROM scored
  WHERE jaccard >= 0.3
  ORDER BY source_id, target_id, jaccard DESC, city_slug ASC
)
INSERT INTO product_edges (source_id, target_id, edge_type, strength, metadata)
SELECT source_id, target_id, 'tag_overlap', jaccard,
  jsonb_build_object('shared_tags', shared, 'city_slug', city_slug)
FROM deduped
ON CONFLICT (source_id, target_id, edge_type)
DO UPDATE SET strength = EXCLUDED.strength, metadata = EXCLUDED.metadata, computed_at = now();

INSERT INTO product_edges (source_id, target_id, edge_type, strength, metadata)
SELECT target_id, source_id, 'tag_overlap', strength, metadata
FROM product_edges
WHERE edge_type = 'tag_overlap' AND source_id < target_id
ON CONFLICT DO NOTHING;
