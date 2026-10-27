import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { centsToRandInput, randToCents } from "@/lib/format";

/**
 * Free-typing money field: keeps what the user types (no forced "0.00"
 * reformat or cursor jumps while typing) and tidies to 2 decimals on blur.
 */
export function MoneyInput({
  cents,
  onCents,
  placeholder,
}: {
  cents: number | null | undefined;
  onCents: (cents: number | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => (cents ? centsToRandInput(cents) : ""));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(cents ? centsToRandInput(cents) : "");
  }, [cents, focused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
        const parts = v.split(".");
        const clean = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}` : v;
        setText(clean);
        onCents(clean === "" || clean === "." ? null : randToCents(clean));
      }}
      onBlur={() => {
        setFocused(false);
        setText(cents ? centsToRandInput(cents) : "");
      }}
    />
  );
}
