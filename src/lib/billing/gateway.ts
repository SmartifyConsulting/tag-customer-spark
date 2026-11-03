// Browser-safe helper (mirrors Snappy Sign): send the shopper to an external
// payment page in a way that survives the preview iframe. Tries the top
// window, then a new tab, then same-tab. Returns false if all were blocked so
// the caller can show a manual link.
export function goToGateway(url: string): boolean {
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return true;
    }
  } catch {
    // cross-origin top — fall through
  }
  if (window.self !== window.top) {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) return true;
  }
  try {
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
}

export function paymentReturnUrls(provider: "paypal" | "payfast") {
  const origin = window.location.origin;
  return {
    return_url: `${origin}/payment/${provider}/return`,
    cancel_url: `${origin}/payment/${provider}/return?cancelled=1`,
    notify_url: `${origin}/api/public/webhooks/payfast-itn`,
  };
}
