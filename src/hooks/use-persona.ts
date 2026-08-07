import { useAuth } from "@/hooks/use-auth";
import { personaFromRoles, type Persona } from "@/lib/nav";

// TAG is one platform with staff-only sections (PRODUCT, BUSINESS) and
// universal ones (PURCHASE, OWNERSHIP). A staff member is also a shopper,
// so this is a capability flag rather than an either/or persona.
export function useIsStaff(): boolean {
  const { roles } = useAuth();
  return (roles?.length ?? 0) > 0;
}

// Back-compat for surfaces that still label the front door.
export function usePersona(): Persona {
  const { roles } = useAuth();
  return personaFromRoles(roles);
}
