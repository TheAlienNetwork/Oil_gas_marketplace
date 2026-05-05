import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'

interface CartDropdownProps {
  open: boolean
  onClose: () => void
}

export default function CartDropdown({ open, onClose }: CartDropdownProps) {
  const navigate = useNavigate()
  const { lines, count, subtotalCents, removeLine } = useCart()

  if (!open) return null

  return (
    <div className="absolute right-0 top-full z-[60] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/98 shadow-market-lg backdrop-blur-xl">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-semibold text-white">Cart</p>
        <p className="text-xs text-slate-500">
          {count === 0 ? 'Empty' : `${count} ${count === 1 ? 'item' : 'items'}`}
        </p>
      </div>
      {lines.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Browse the marketplace and add paid listings here.
        </div>
      ) : (
        <>
          <ul className="max-h-64 overflow-y-auto py-2">
            {lines.map((line) => (
              <li
                key={line.listingId}
                className="flex gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10">
                  {line.thumbnailUrl ? (
                    <img src={line.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-600">◆</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/listing/${line.listingId}`}
                    onClick={onClose}
                    className="line-clamp-2 text-sm font-medium text-white hover:text-primary-300"
                  >
                    {line.title}
                  </Link>
                  <p className="text-xs text-slate-500">{line.sellerName}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-slate-300">
                    ${(line.priceCents / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.listingId)}
                  className="shrink-0 self-start rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/10 hover:text-red-300"
                  aria-label="Remove"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-semibold tabular-nums text-white">
                ${(subtotalCents / 100).toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate('/checkout')
              }}
              className="mt-3 w-full rounded-full bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500"
            >
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  )
}
