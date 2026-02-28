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
    const interval = setInterval(fetchPrices, 10 * 60 * 1000) // refresh every 10 min (respect 20/hr limit)
    return () => clearInterval(interval)
  }, [])

  if (loading && prices.length === 0) {
    return (
      <div className="border-b border-slate-800 bg-slate-850 px-4 py-1.5">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 text-xs text-slate-500">
          Loading oil prices…
        </div>
      </div>
    )
  }

  if (error && prices.length === 0) {
    return null
  }

  return (
    <div className="border-b border-slate-800 bg-slate-850 px-4 py-1.5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 text-xs sm:gap-8">
        {prices.map((item) => (
          <span key={item.code} className="flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-500">{item.name}:</span>
            <span className="font-medium text-white">
              {item.currency} {typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
            </span>
            {item.change_24h != null && (
              <span
                className={
                  item.change_24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                }
              >
                ({item.change_24h >= 0 ? '+' : ''}{item.change_24h.toFixed(2)})
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
