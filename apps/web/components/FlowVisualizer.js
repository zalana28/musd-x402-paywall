import { useState } from "react";

const ICONS = {
  request: "→",
  "402": "$",
  sign: "✎",
  retry: "⇄",
  verify: "✓",
  settle: "⛓",
  error: "!",
};

function StepNode({ step, active, onClick }) {
  const status = step.status;
  const color =
    status === "done"
      ? "border-mezo-mint/70 bg-mezo-mint/10 text-mezo-mint"
      : status === "failed"
      ? "border-mezo-rose/70 bg-mezo-rose/10 text-mezo-rose"
      : "border-mezo-orange bg-mezo-orange/15 text-mezo-amber";

  return (
    <button
      onClick={onClick}
      disabled={!step.detail}
      className={`group relative flex w-full flex-col items-center gap-2 focus:outline-none ${
        step.detail ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <span className="relative flex h-11 w-11 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-mezo-orange animate-pulse-ring" />
        <span
          className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 text-base font-bold transition-all duration-300 ${color} ${
            active && step.detail ? "scale-110 shadow-glow-sm" : ""
          }`}
        >
          {ICONS[step.id] ?? "·"}
        </span>
      </span>
      <span className="text-center font-display text-[12.5px] font-semibold leading-tight text-white/80">
        {step.label}
      </span>
      {status === "failed" && (
        <span className="mono text-[10px] text-mezo-rose/90">failed</span>
      )}
      {status === "done" && (
        <span className="mono text-[10px] text-mezo-mint/80">ok</span>
      )}
    </button>
  );
}

export default function FlowVisualizer({ steps, total, agent }) {
  const [selected, setSelected] = useState(null);
  const failed = steps.some((s) => s.status === "failed");
  const sel =
    selected != null && steps[selected]
      ? steps[selected]
      : [...steps].reverse().find((s) => s.detail) || steps[0];
  const selIndex = steps.findIndex((s) => s === sel);

  if (!steps.length) return null;

  return (
    <div className="glow-card animate-fade-up p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">x402 handshake · live</p>
          <h3 className="font-display text-lg font-bold text-white">
            Protocol flow
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {agent && (
            <span className="chip">
              agent {agent.slice(0, 6)}…{agent.slice(-4)}
            </span>
          )}
          <span
            className={`chip ${
              failed ? "!border-mezo-rose/40 !text-mezo-rose" : ""
            }`}
          >
            {failed ? "needs funding" : `${steps.length}/${total ?? steps.length} steps`}
          </span>
        </div>
      </div>

      {/* pipeline */}
      <div className="relative flex items-start justify-between gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s.id + i} className="flex min-w-[92px] flex-1 items-start">
            <div className="flex-1">
              <StepNode
                step={s}
                active={i === selIndex}
                onClick={() => setSelected(i)}
              />
            </div>
            {i < steps.length - 1 && (
              <div className="relative mt-5 h-[2px] w-6 shrink-0 rounded sm:w-8">
                <div className="absolute inset-0 rounded bg-white/10" />
                <div className="absolute inset-0 rounded bg-gradient-to-r from-mezo-orange to-mezo-ember" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* payload inspector */}
      {sel?.detail && (
        <div className="mt-4 animate-fade-up">
          <div className="mb-2 flex items-center justify-between">
            <p className="label">
              inspector · step {selIndex + 1} — {sel.label}
            </p>
            <span className="mono text-[10px] text-white/30">
              click any node
            </span>
          </div>
          <pre className="payload">
            {JSON.stringify(sel.detail, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
