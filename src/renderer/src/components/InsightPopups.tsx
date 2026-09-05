import { Sparkles, X } from 'lucide-react'

export interface InsightCard {
  id: string
  fact: string
}

export default function InsightPopups({
  insights,
  onDismiss
}: {
  insights: InsightCard[]
  onDismiss: (id: string) => void
}) {
  if (insights.length === 0) return null

  return (
    <div className="pointer-events-none absolute right-4 top-16 z-[5] w-64 space-y-2">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="pointer-events-auto border border-[var(--owl-border)] bg-[var(--owl-panel)] p-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--owl-accent)]" />
            <p className="flex-1 text-xs leading-relaxed text-[var(--owl-text)]">{insight.fact}</p>
            <button
              onClick={() => onDismiss(insight.id)}
              className="owl-hover shrink-0 p-0.5 text-[var(--owl-text-muted)]"
              aria-label="Dismiss insight"
            >
              <X size={12} />
            </button>
          </div>
          <p className="mt-1.5 pl-[21px] text-[10px] text-[var(--owl-text-muted)]">
            Owly · worth double-checking
          </p>
        </div>
      ))}
    </div>
  )
}
