import { useMemo } from "react";

export function ScanHeatmap({ data }: { data: number[][] }) {
  const max = useMemo(() => Math.max(1, ...data.flat()), [data]);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="mb-1 pl-[44px] text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Hour of day
        </div>
        <div className="flex gap-1">
          <div className="grid grid-cols-[40px_repeat(24,_minmax(14px,1fr))] gap-0.5 text-[10px]">
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-center text-muted-foreground">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
            {data.map((row, d) => (
              <div key={`row-${d}`} className="contents">
                <div className="text-muted-foreground self-center">{days[d]}</div>
                {row.map((v, h) => {
                  const op = v / max;
                  return (
                    <div
                      key={`${d}-${h}`}
                      title={`${days[d]} ${h}:00 — ${v} scans`}
                      className="aspect-square rounded-sm"
                      style={{ backgroundColor: `rgba(3, 28, 77, ${0.08 + op * 0.85})` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center pl-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
            Day of week
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScanHeatmapLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>Fewer scans</span>
      <div
        className="h-2 w-24 rounded-full"
        style={{
          background:
            "linear-gradient(to right, rgba(3,28,77,0.08), rgba(3,28,77,0.93))",
        }}
      />
      <span>More scans</span>
    </div>
  );
}
