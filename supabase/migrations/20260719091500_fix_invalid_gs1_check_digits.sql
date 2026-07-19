-- One-off data fix: recompute the trailing GS1 check digit for existing
-- products whose GTIN fails checksum validation (e.g. AI-generated demo
-- catalogue data — plausible-looking numbers with a mechanically wrong
-- last digit). isValidGtin()/validGtin14() in the app correctly reject
-- these, which silently blocked QR generation and the public passport
-- page for every affected product. Only the last digit is replaced; the
-- identifying digits — and therefore which retailers share a GTIN — are
-- untouched. Products with a malformed length (not 8/12/13/14 digits)
-- are left alone; there's nothing safe to infer there.
CREATE OR REPLACE FUNCTION public.gs1_check_digit(padded14 text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (10 - (
    SUM(
      substr(padded14, i, 1)::int *
      CASE WHEN (i - 1) % 2 = 0 THEN 3 ELSE 1 END
    ) % 10
  )) % 10
  FROM generate_series(1, 13) AS i;
$$;

UPDATE public.products
SET gtin = left(lpad(gtin, 14, '0'), 13) || public.gs1_check_digit(lpad(gtin, 14, '0'))::text
WHERE gtin ~ '^(\d{8}|\d{12}|\d{13}|\d{14})$'
  AND substr(lpad(gtin, 14, '0'), 14, 1)::int <> public.gs1_check_digit(lpad(gtin, 14, '0'));

DROP FUNCTION public.gs1_check_digit(text);
