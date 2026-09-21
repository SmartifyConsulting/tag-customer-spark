import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Copies keys saved in Admin > Integrations into the environment the rest of
// the app reads from. Cached for a minute; never blocks or breaks a request.
const integrationEnvMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const { applyIntegrationOverlay } = await import("./lib/integration-env.server");
    await applyIntegrationOverlay();
  } catch (error) {
    console.warn("[integrations] could not apply saved keys", (error as Error)?.message);
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, integrationEnvMiddleware],
}));
