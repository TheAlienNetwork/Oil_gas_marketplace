import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import CartDropdown from '@/components/CartDropdown'

const navLink =
  'rounded-full px-3.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white'
const navLinkPrimary =
  'rounded-full bg-primary-600/90 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { count: cartCount } = useCart()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setProfileOpen(false)
      }
      if (cartRef.current && !cartRef.current.contains(target)) {
        setCartOpen(false)
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
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-slate-950/75 backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-[3.75rem] max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link to="/" className="group flex min-w-0 shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/25 to-slate-800 ring-1 ring-white/10 transition group-hover:ring-primary-500/30">
            <img src="/The_Patch_Logo.png" alt="" className="h-6 w-6 object-contain opacity-90" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg tracking-tight text-white">The Patch</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-400/90">
              Marketplace
            </span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center md:flex md:items-center md:gap-1">
          <Link
            to="/marketplace"
            className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.09]"
          >
            Browse
          </Link>
          <Link to="/dashboard" className={navLink}>
            Sell
          </Link>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Link to="/marketplace" className={`${navLink} md:hidden`}>
            Shop
          </Link>

          <div className="relative" ref={cartRef}>
            <button
              type="button"
              onClick={() => {
                setCartOpen((o) => !o)
                setProfileOpen(false)
              }}
              className="relative rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label={`Shopping cart${cartCount ? `, ${cartCount} items` : ''}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218a1.125 1.125 0 001.09-.835l1.125-5.25a1.125 1.125 0 00-1.09-1.411H7.5m0 0l-1.432-8.323A.75.75 0 005.25 3H2.25m5.25 13.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm12 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
            <CartDropdown open={cartOpen} onClose={() => setCartOpen(false)} />
          </div>

          {user ? (
            <>
              <Link to="/dashboard" className={`${navLinkPrimary} hidden md:inline-flex`}>
                Dashboard
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((o) => !o)
                    setCartOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-full p-0.5 pl-1 ring-2 ring-transparent transition hover:ring-white/15 focus:outline-none focus:ring-primary-500/50"
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-300 ring-1 ring-white/10">
                      {(profile?.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden pr-2 text-xs font-medium text-slate-500 sm:inline">Menu</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/95 py-1 shadow-market-lg backdrop-blur-xl">
                    <div className="border-b border-white/[0.06] px-4 py-3">
                      <p className="truncate text-sm font-medium text-white">
                        {profile?.display_name || 'User'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/purchases"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Orders
                    </Link>
                    <Link
                      to="/messages"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Messages
                    </Link>
                    <Link
                      to="/apps"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Library
                    </Link>
                    <Link
                      to="/organizations"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Organizations
                    </Link>
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white md:hidden"
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/sign-in" className={navLink}>
                Sign in
              </Link>
              <Link to="/sign-up" className={navLinkPrimary}>
                Join
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
