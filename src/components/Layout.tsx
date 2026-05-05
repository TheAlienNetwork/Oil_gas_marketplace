import { Link, Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import LiveOilPrice from './LiveOilPrice'
import PWAInstallPrompt from './PWAInstallPrompt'
import { isDemoMode } from '@/lib/supabase'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      {isDemoMode && (
        <div className="border-b border-amber-800/50 bg-amber-950/90 px-4 py-2.5 text-center text-sm text-amber-100/95 backdrop-blur-sm">
          Demo mode — add Supabase credentials in <code className="rounded bg-black/20 px-1">.env</code> for live
          data and Stripe.
        </div>
      )}
      <LiveOilPrice />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-white/[0.06] bg-slate-950/80 py-14 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <div className="lg:col-span-2">
              <p className="font-display text-2xl text-white">The Patch</p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Curated digital tools and applications for oil & gas professionals. Secure checkout,
                trusted sellers, instant delivery.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Shop</p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li>
                  <Link to="/marketplace" className="transition hover:text-primary-400">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link to="/purchases" className="transition hover:text-primary-400">
                    Your purchases
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sell</p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li>
                  <Link to="/dashboard" className="transition hover:text-primary-400">
                    Seller dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/sign-up" className="transition hover:text-primary-400">
                    Create account
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-8 text-xs text-slate-600 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} The Patch. All rights reserved.</p>
            <p className="text-slate-600">Payments processed securely with Stripe.</p>
          </div>
        </div>
      </footer>
      <PWAInstallPrompt />
    </div>
  )
}
