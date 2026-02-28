import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setProfileOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md shadow-sm">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold tracking-tight text-white">
            The Patch
          </span>
          <span className="hidden rounded bg-primary-600/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-400 sm:inline">
            Oil & Gas
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          <Link
            to="/marketplace"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Marketplace
          </Link>
          <Link
            to="/feed"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Feed
          </Link>
          <Link
            to="/talent"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Talent
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                to="/purchases"
                className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white sm:inline"
              >
                Purchases
              </Link>
              <Link
                to="/messages"
                className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white sm:inline"
              >
                Messages
              </Link>
              <Link
                to="/dashboard"
                className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:inline"
              >
                Sell
              </Link>
              <Link
                to="/organizations"
                className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:inline"
              >
                Orgs
              </Link>

              {/* Mobile: avatar links straight to profile. Desktop: avatar opens dropdown */}
              <Link
                to="/profile"
                className="sm:hidden flex items-center rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Go to profile"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-600 text-sm font-semibold text-slate-300">
                    {(profile?.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </Link>
              <div className="relative hidden sm:block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Profile menu"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-600 text-sm font-semibold text-slate-300">
                      {(profile?.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl">
                    <div className="border-b border-slate-700 px-4 py-2">
                      <p className="truncate text-sm font-medium text-white">
                        {profile?.display_name || 'User'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      My profile
                    </Link>
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white md:hidden"
                    >
                      Seller dashboard
                    </Link>
                    <Link
                      to="/organizations"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white lg:hidden"
                    >
                      Organizations
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
