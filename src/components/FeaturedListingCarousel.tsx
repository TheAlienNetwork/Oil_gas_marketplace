import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ListingCard from '@/components/ListingCard'
import type { Listing } from '@/lib/types'

const AUTO_MS = 6500
const PAUSE_AFTER_MANUAL_MS = 12000
const TRANSITION_MS = 520

type Props = {
  listings: Listing[]
}

export default function FeaturedListingCarousel({ listings }: Props) {
  const n = listings.length
  const reducedMotion = usePrefersReducedMotion()
  const listingsKey = useMemo(() => listings.map((l) => l.id).join('|'), [listings])
  const extended = useMemo(() => {
    if (n === 0) return []
    if (n === 1) return listings
    return [...listings, ...listings, ...listings]
  }, [listings, n])

  const [index, setIndex] = useState(() => (n > 1 ? n : 0))
  const [noTransition, setNoTransition] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [translateX, setTranslateX] = useState(0)
  const pauseUntilRef = useRef(0)
  const indexRef = useRef(index)

  indexRef.current = index

  useEffect(() => {
    if (n > 1) {
      setNoTransition(true)
      setIndex(n)
    } else if (n === 1) {
      setIndex(0)
    }
  }, [n, listingsKey])

  const updateTranslate = useCallback(() => {
    const container = containerRef.current
    const slides = slideRefs.current
    const pos = index
    if (!container || slides[pos] == null) return
    const slide = slides[pos]!
    const cw = container.clientWidth
    const cx = slide.offsetLeft + slide.offsetWidth / 2
    setTranslateX(cw / 2 - cx)
  }, [index])

  useLayoutEffect(() => {
    updateTranslate()
  }, [index, extended.length, updateTranslate, noTransition])

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => updateTranslate())
    const el = containerRef.current
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [updateTranslate])

  useLayoutEffect(() => {
    if (!noTransition) return
    const id = requestAnimationFrame(() => setNoTransition(false))
    return () => cancelAnimationFrame(id)
  }, [index, noTransition])

  const goNext = useCallback(() => {
    if (n <= 1) return
    setIndex((i) => i + 1)
  }, [n])

  const goPrev = useCallback(() => {
    if (n <= 1) return
    setIndex((i) => i - 1)
  }, [n])

  const onManualPrev = useCallback(() => {
    pauseUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS
    goPrev()
  }, [goPrev])

  const onManualNext = useCallback(() => {
    pauseUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS
    goNext()
  }, [goNext])

  useEffect(() => {
    if (reducedMotion || n <= 1) return

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (Date.now() < pauseUntilRef.current) return
      goNext()
    }

    const id = window.setInterval(tick, AUTO_MS)
    return () => window.clearInterval(id)
  }, [goNext, n, reducedMotion])

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.propertyName !== 'transform') return
      if (n <= 1) return
      const curr = indexRef.current
      let next = curr
      if (curr >= 2 * n) next = curr - n
      else if (curr < n) next = curr + n
      else return
      setNoTransition(true)
      setIndex(next)
    },
    [n]
  )

  if (n === 0) return null

  if (n === 1) {
    return (
      <div className="mx-auto mt-12 max-w-md">
        <div className="mx-auto scale-105 transform transition-transform duration-500">
          <ListingCard listing={listings[0]} />
        </div>
      </div>
    )
  }

  const transitionStyle =
    reducedMotion || noTransition
      ? undefined
      : ({ transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` } as const)

  return (
    <div className="relative mt-12">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-slate-950 via-slate-950/90 to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-slate-950 via-slate-950/90 to-transparent sm:w-24" />

      <div ref={containerRef} className="relative overflow-hidden px-2 py-6 sm:px-4">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured listings"
          className="flex items-center gap-5 sm:gap-6 md:gap-8"
          style={{
            transform: `translateX(${translateX}px)`,
            willChange: reducedMotion ? undefined : 'transform',
            ...transitionStyle,
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {extended.map((listing, idx) => {
            const isCenter = idx === index
            return (
              <div
                key={`${listing.id}-${idx}`}
                ref={(el) => {
                  slideRefs.current[idx] = el
                }}
                aria-hidden={!isCenter}
                className={`shrink-0 ${
                  isCenter ? 'z-10 scale-100 opacity-100' : 'z-0 scale-[0.88] opacity-[0.72]'
                }`}
                style={{
                  width: 'min(100vw - 4rem, 320px)',
                  transformOrigin: 'center center',
                }}
              >
                <ListingCard listing={listing} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onManualPrev}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-900/80 text-white shadow-lg backdrop-blur-sm transition hover:border-primary-500/40 hover:bg-slate-800"
          aria-label="Previous featured listing"
        >
          <span aria-hidden className="text-lg leading-none">
            ‹
          </span>
        </button>
        <button
          type="button"
          onClick={onManualNext}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-900/80 text-white shadow-lg backdrop-blur-sm transition hover:border-primary-500/40 hover:bg-slate-800"
          aria-label="Next featured listing"
        >
          <span aria-hidden className="text-lg leading-none">
            ›
          </span>
        </button>
      </div>

      <p className="sr-only">
        Use the previous and next buttons to move through listings. The carousel also advances automatically.
      </p>
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return reduced
}
