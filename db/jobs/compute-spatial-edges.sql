-- Haversine spatial edges, max 5km radius, top 10 neighbours per source.
-- Adapted for this schema: city_slug is the city key.

WITH distances AS (
  SELECT a.slug AS source_id, b.slug AS target_id,
    2 * 6371 * asin(sqrt(
      sin(radians((b.latitude - a.latitude) / 2))^2 +
      cos(radians(a.latitude)) * cos(radians(b.latitude)) *
      sin(radians((b.longitude - a.longitude) / 2))^2
    )) AS distance_km
  FROM products a
  JOIN products b ON a.city_slug = b.city_slug AND a.slug <> b.slug
  WHERE a.slug IS NOT NULL AND b.slug IS NOT NULL
    AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
    AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
),
ranked AS (
  SELECT source_id, target_id, distance_km,
    row_number() OVER (PARTITION BY source_id ORDER BY distance_km) AS rn
  FROM (
    SELECT source_id, target_id, MIN(distance_km) AS distance_km
    FROM distances
    WHERE distance_km <= 5.0
    GROUP BY source_id, target_id
  ) deduped
)
INSERT INTO product_edges (source_id, target_id, edge_type, strength, metadata)
SELECT source_id, target_id, 'spatial',
  1.0 / (1.0 + distance_km),
  jsonb_build_object('distance_km', distance_km)
FROM ranked
WHERE rn <= 10
ON CONFLICT (source_id, target_id, edge_type)
DO UPDATE SET strength = EXCLUDED.strength, metadata = EXCLUDED.metadata, computed_at = now();
