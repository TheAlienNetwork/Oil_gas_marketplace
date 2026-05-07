-- One library row per user per listing (prevents duplicate free “Add to library” clicks).

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, listing_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.purchase_grants
)
DELETE FROM public.purchase_grants
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_grants_user_listing_uidx
  ON public.purchase_grants (user_id, listing_id);
