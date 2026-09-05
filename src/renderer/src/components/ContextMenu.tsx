export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-20"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        style={{ left: x, top: y }}
        className="absolute min-w-[160px] border border-[var(--owl-border)] bg-[var(--owl-panel)] py-1 text-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              onClose()
              item.onClick()
            }}
            className={`owl-hover flex w-full items-center px-3 py-1.5 text-left ${
              item.danger ? 'text-red-500' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
