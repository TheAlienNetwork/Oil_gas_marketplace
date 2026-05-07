/** After embedded checkout, buyer returns to /purchases?session_id=… — then we clear these cart lines. */

export const PENDING_CART_CLEAR_KEY = 'the_patch_pending_cart_clear'

export type PendingCartClear = { listingIds: string[] }

export function setPendingCartClear(listingIds: string[]) {
  if (listingIds.length === 0) return
  try {
    sessionStorage.setItem(PENDING_CART_CLEAR_KEY, JSON.stringify({ listingIds } satisfies PendingCartClear))
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumePendingCartClear(): PendingCartClear | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CART_CLEAR_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_CART_CLEAR_KEY)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const ids = (parsed as PendingCartClear).listingIds
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return null
    return { listingIds: ids }
  } catch {
    return null
  }
}

export function clearPendingCartClear() {
  try {
    sessionStorage.removeItem(PENDING_CART_CLEAR_KEY)
  } catch {
    /* ignore */
  }
}
