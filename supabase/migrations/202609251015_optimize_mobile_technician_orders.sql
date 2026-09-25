CREATE INDEX IF NOT EXISTS orders_technician_service_date_time_idx
ON public.orders (technician_id, service_date, service_time)
WHERE technician_id IS NOT NULL
  AND service_date IS NOT NULL;
