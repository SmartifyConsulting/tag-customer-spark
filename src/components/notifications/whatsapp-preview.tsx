import { motion } from "framer-motion";
import { CheckCheck, Clock } from "lucide-react";

type Props = {
  retailerName?: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
  headline?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  expiresAt?: string | null;
  redemptionCode?: string | null;
};

export function WhatsAppPreview({
  retailerName = "Your store",
  logoUrl,
  imageUrl,
  headline,
  body,
  ctaLabel,
  expiresAt,
  redemptionCode,
}: Props) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-slate-900 to-slate-800 p-2 shadow-xl shadow-primary/10 w-full max-w-xs mx-auto">
      <div className="rounded-2xl overflow-hidden bg-[#ECE5DD] dark:bg-[#0b141a]">
        {/* header */}
        <div className="flex items-center gap-2 bg-[#075E54] text-white px-3 py-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-white/20 grid place-items-center text-[10px] font-bold">
              {retailerName.slice(0, 1)}
            </div>
          )}
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">{retailerName}</p>
            <p className="text-[10px] text-white/70">business · online</p>
          </div>
        </div>

        {/* messages */}
        <div className="p-3 space-y-2 min-h-[260px] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22%23000%22 fill-opacity=%220.04%22/></svg>')]">
          <motion.div
            key={(headline ?? "") + (body ?? "") + (imageUrl ?? "")}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="ml-auto max-w-[88%] rounded-lg bg-[#DCF8C6] dark:bg-[#005c4b] dark:text-white text-slate-900 text-[12.5px] shadow-sm overflow-hidden"
          >
            {imageUrl && (
              <img src={imageUrl} alt="" className="w-full aspect-[4/3] object-cover" />
            )}
            <div className="px-2.5 py-2 space-y-1.5">
              {headline && <p className="font-semibold leading-tight">{headline}</p>}
              {body && <p className="whitespace-pre-wrap leading-snug">{body}</p>}
              {redemptionCode && (
                <p className="font-mono text-[11px] bg-black/5 dark:bg-white/10 rounded px-1.5 py-0.5 inline-block">
                  Code: {redemptionCode}
                </p>
              )}
              {expiresAt && (
                <p className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-white/60">
                  <Clock className="h-2.5 w-2.5" /> Expires{" "}
                  {new Date(expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-white/60">
                {time}
                <CheckCheck className="h-3 w-3 text-sky-500" />
              </div>
            </div>
            {ctaLabel && (
              <div className="border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  disabled
                  className="w-full text-center text-[12.5px] font-medium text-[#075E54] dark:text-[#25d366] py-2"
                >
                  {ctaLabel}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
