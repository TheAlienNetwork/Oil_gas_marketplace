import { useEffect, useState } from 'react'

const API_URL = 'https://api.oilpriceapi.com/v1/demo/prices'

interface PriceItem {
  code: string
  name: string
  price: number
  currency: string
  change_24h: number | null
}

export default function LiveOilPrice() {
  const [prices, setPrices] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(API_URL)
        const json = await res.json()
        if (json?.data?.prices) {
          const relevant = (json.data.prices as PriceItem[]).filter(
            (p) =>
              p.code === 'WTI_USD' ||
              p.code === 'BRENT_CRUDE_USD' ||
              p.code === 'NATURAL_GAS_USD'
          )
          setPrices(relevant)
        }
        setError(false)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading && prices.length === 0) {
    return (
      <div className="border-b border-white/[0.05] bg-slate-950/90 px-4 py-2">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-6 text-[11px] font-medium uppercase tracking-widest text-slate-600">
          Markets loading…
        </div>
      </div>
    )
  }

  if (error && prices.length === 0) {
    return null
  }

  return (
    <div className="border-b border-white/[0.05] bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 px-4 py-2">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-10 gap-y-2 sm:justify-between lg:px-4">
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-600 sm:inline">
          Benchmarks
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1">
          {prices.map((item) => (
            <span key={item.code} className="flex items-baseline gap-2 text-[13px]">
              <span className="text-slate-500">{item.name}</span>
              <span className="font-semibold tabular-nums text-slate-100">
                {item.currency} {typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
              </span>
              {item.change_24h != null && (
                <span
                  className={`text-xs font-medium tabular-nums ${
                    item.change_24h >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'
                  }`}
                >
                  {item.change_24h >= 0 ? '+' : ''}
                  {item.change_24h.toFixed(2)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
