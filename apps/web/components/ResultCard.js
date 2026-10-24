export default function ResultCard({ result, endpointId }) {
  if (!result) return null;
  const { sponsored, endpoint, haiku, answer, summary, meta, sponsoredLabel } = result;
  const isSponsored = Boolean(sponsored);

  return (
    <div className="glass animate-fade-up p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="label">{isSponsored ? "response · sponsored demo" : "response · paid content"}</p>
          <h3 className="font-display text-lg font-bold text-white">
            {(endpoint || endpointId)}{" "}
            <span className={isSponsored ? "text-mezo-amber" : "text-mezo-mint"}>
              · {isSponsored ? "sponsored" : "unlocked"}
            </span>
          </h3>
        </div>
        <span
          className={`chip ${
            isSponsored ? "!border-mezo-amber/40 !text-mezo-amber" : "!border-mezo-mint/40 !text-mezo-mint"
          }`}
        >
          {isSponsored ? "sponsored" : "paid ✓"}
        </span>
      </div>

      {sponsoredLabel && (
        <p className="mb-4 rounded-md border border-mezo-amber/15 bg-mezo-amber/5 px-3 py-1.5 text-xs text-white/45">
          {sponsoredLabel}
        </p>
      )}

      {haiku && (
        <div className="glass-soft relative overflow-hidden p-6 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mezo-orange/10 blur-2xl" />
          <pre className="whitespace-pre-wrap font-display text-xl font-medium leading-relaxed text-mezo-gold">
            {haiku}
          </pre>
        </div>
      )}
      {answer && (
        <p className="glass-soft p-5 text-[15px] leading-relaxed text-white/85">
          {answer}
        </p>
      )}
      {summary && (
        <p className="glass-soft whitespace-pre-wrap p-5 text-[15px] leading-relaxed text-white/85">
          {summary}
        </p>
      )}
      {result.score != null && result.endpoint === "sentiment" ? (
        <div className="glass-soft p-5">
          <p className="font-display text-2xl font-semibold text-mezo-gold">{result.score}</p>
          <p className="text-sm text-white/50">label: {result.label} · matched: {(result.matched || []).join(", ") || "—"}</p>
        </div>
      ) : null}

      {meta && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip">model {meta.model}</span>
          <span className="chip">{meta.network}</span>
        </div>
      )}
    </div>
  );
}
