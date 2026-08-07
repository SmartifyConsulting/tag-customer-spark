import { useAuth } from "@/hooks/use-auth";
import { personaFromRoles, type Persona } from "@/lib/nav";

// Which front door is this user standing in? Staff roles → TAG Retail,
// everyone else (shoppers) → TAG Wallet. Derived, never user-selectable,
// so the two surfaces can never disagree about who someone is.
export function usePersona(): Persona {
  const { roles } = useAuth();
  return personaFromRoles(roles);
}
