// Server-only PayFast helpers
import crypto from "crypto";

export const PAYFAST_ENV = (process.env.PAYFAST_ENV || "sandbox").toLowerCase();
export const PAYFAST_PROCESS_URL =
  PAYFAST_ENV === "live"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";
export const PAYFAST_VALIDATE_URL =
  PAYFAST_ENV === "live"
    ? "https://www.payfast.co.za/eng/query/validate"
    : "https://sandbox.payfast.co.za/eng/query/validate";

// Mirror PHP urlencode
export function pfEncode(v: string): string {
  return encodeURIComponent(v)
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/~/g, "%7E");
}

export function buildPfSignature(
  fields: Record<string, string>,
  passphrase: string,
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "signature") continue;
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}=${pfEncode(String(v))}`);
  }
  let str = parts.join("&");
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash("md5").update(str).digest("hex");
}
