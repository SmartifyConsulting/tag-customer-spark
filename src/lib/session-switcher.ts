// Remembers every account signed into in this browser so the avatar menu
// can swap between them instantly, without re-entering a password each
// time. Tokens are stored client-side only (localStorage) — same trust
// boundary as the Supabase SDK's own session storage.

export type RememberedSession = {
  email: string;
  access_token: string;
  refresh_token: string;
  rememberedAt: string;
};

const KEY = "tag-remembered-sessions";

export function listRememberedSessions(): RememberedSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RememberedSession[]) : [];
  } catch {
    return [];
  }
}

export function rememberSession(session: {
  user: { email?: string | null };
  access_token: string;
  refresh_token: string;
}) {
  if (typeof window === "undefined" || !session.user.email) return;
  const existing = listRememberedSessions().filter((s) => s.email !== session.user.email);
  const next: RememberedSession[] = [
    ...existing,
    {
      email: session.user.email,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      rememberedAt: new Date().toISOString(),
    },
  ];
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function forgetSession(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify(listRememberedSessions().filter((s) => s.email !== email)),
  );
}
