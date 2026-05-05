import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Listing } from '@/lib/types'

const STORAGE_KEY = 'the_patch_cart_v1'

export interface CartLine {
  listingId: string
  title: string
  priceCents: number
  thumbnailUrl: string | null
  sellerId: string
  sellerName: string
}

interface CartContextValue {
  lines: CartLine[]
  count: number
  subtotalCents: number
  addLineFromListing: (listing: Listing) => { ok: true } | { ok: false; reason: string }
  removeLine: (listingId: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function loadLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is CartLine =>
        typeof row === 'object' &&
        row !== null &&
        typeof (row as CartLine).listingId === 'string' &&
        typeof (row as CartLine).priceCents === 'number'
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  useEffect(() => {
    setLines(loadLines())
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // ignore quota
    }
  }, [lines])

  const addLineFromListing = useCallback((listing: Listing) => {
    const sub = Boolean((listing as Listing & { is_subscription?: boolean }).is_subscription)
    if (sub) {
      return { ok: false as const, reason: 'Subscription listings use purchase on the product page.' }
    }
    if (listing.price <= 0) {
      return { ok: false as const, reason: 'Free items can be added from the product page with “Add to library”.' }
    }
    const sellerName = listing.profiles?.display_name || 'Seller'
    const line: CartLine = {
      listingId: listing.id,
      title: listing.title,
      priceCents: listing.price,
      thumbnailUrl: listing.thumbnail_url,
      sellerId: listing.seller_id,
      sellerName,
    }
    setLines((prev) => {
      if (prev.some((p) => p.listingId === line.listingId)) return prev
      return [...prev, line]
    })
    return { ok: true as const }
  }, [])

  const removeLine = useCallback((listingId: string) => {
    setLines((prev) => prev.filter((l) => l.listingId !== listingId))
  }, [])

  const clearCart = useCallback(() => setLines([]), [])

  const value = useMemo<CartContextValue>(() => {
    const subtotalCents = lines.reduce((s, l) => s + l.priceCents, 0)
    return {
      lines,
      count: lines.length,
      subtotalCents,
      addLineFromListing,
      removeLine,
      clearCart,
    }
  }, [lines, addLineFromListing, removeLine, clearCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
