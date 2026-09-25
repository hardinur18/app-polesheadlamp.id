CREATE INDEX IF NOT EXISTS idx_orders_map_bounds_active
ON public.orders (lat, lng)
WHERE lat IS NOT NULL
  AND lng IS NOT NULL
  AND status <> 'cancelled';
