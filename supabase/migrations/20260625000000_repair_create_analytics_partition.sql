-- Repair: create_analytics_partition missing on some remote DBs (initial_schema marked applied without Section 8).

CREATE OR REPLACE FUNCTION create_analytics_partition(
  partition_name TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$;

REVOKE ALL ON FUNCTION create_analytics_partition(TEXT, DATE, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_analytics_partition(TEXT, DATE, DATE) TO service_role;
