import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-8xl font-normal leading-none text-white/15">404</p>
      <h1 className="mt-6 font-display text-3xl font-normal tracking-tight text-white">Page not found</h1>
      <p className="mt-4 text-sm text-slate-400">
        That URL does not exist on The Patch. Check the link or head back to the marketplace.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/marketplace"
          className="rounded-full bg-primary-600 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-500"
        >
          Browse marketplace
        </Link>
        <Link
          to="/"
          className="rounded-full border border-white/15 px-8 py-3 text-sm font-semibold text-slate-200 hover:border-white/25 hover:text-white"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
