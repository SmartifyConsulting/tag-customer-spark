/** Canonicalize common display labels without inventing unsupported model IDs. */
export function normalizeOpenAiModel(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  const canonical = trimmed.toLowerCase().replace(/\s+/g, "-");
  if (/^gpt-4o(?:-mini)?$/.test(canonical)) return canonical;
  // Preserve explicitly supplied API IDs; reject human-readable labels we cannot map safely.
  return trimmed && /^[a-z0-9][a-z0-9._:/-]*$/.test(trimmed) ? trimmed : fallback;
}