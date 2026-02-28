import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import LiveOilPrice from './LiveOilPrice'
import PWAInstallPrompt from './PWAInstallPrompt'
import { isDemoMode } from '@/lib/supabase'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {isDemoMode && (
        <div className="bg-amber-900/80 text-amber-100 text-center py-2 px-4 text-sm">
          Test mode — no database or Stripe. Add Supabase credentials to .env to
          connect. You can still click through all pages and see the UI.
        </div>
      )}
      <LiveOilPrice />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PWAInstallPrompt />
    </div>
  )
}
