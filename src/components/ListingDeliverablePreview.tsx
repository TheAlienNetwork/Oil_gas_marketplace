import type { Listing } from '@/lib/types'
import { CATEGORY_LABELS, LISTING_TYPES, coerceCategory } from '@/lib/constants'
import { displayProductFilename, extensionFromFilename } from '@/lib/productFileMeta'

const fileIcon: Record<string, string> = {
  excel: '📊',
  pdf: '📕',
  word: '📘',
  manuals: '📋',
  desktop_apps: '💾',
  web_apps: '🌐',
}

function deliverableCopy(listing: Listing): { title: string; line: string; detail: string; icon: string } {
  const lt = listing.listing_type
  const savedName = displayProductFilename(listing)
  const extLabel = extensionFromFilename(savedName)

  if (lt === LISTING_TYPES.web_app) {
    return {
      title: "What you'll get",
      line: extLabel ? `Web app bundle ${extLabel}` : 'Web-based application',
      detail: savedName
        ? `Seller uploaded “${savedName}”. Open the hosted bundle from My Purchases after checkout.`
        : 'Delivered as a hosted app bundle you open in the browser from My Purchases after checkout.',
      icon: '🌐',
    }
  }
  if (lt === LISTING_TYPES.desktop_app) {
    return {
      title: "What you'll get",
      line: extLabel ? `Desktop installer ${extLabel}` : 'Desktop app (Windows)',
      detail: savedName
        ? `File name on upload: “${savedName}”. Run the installer on your PC after purchase from My Purchases.`
        : 'Installer .exe or .msi — download and run on your PC after purchase from My Purchases.',
      icon: '⊞',
    }
  }
  const cat = coerceCategory(listing.category)
  const format = CATEGORY_LABELS[cat]
  return {
    title: "What you'll get",
    line: extLabel ? `${format} ${extLabel}` : `${format} file`,
    detail: savedName
      ? `Deliverable file: “${savedName}”. Download from My Purchases after checkout.`
      : 'Digital download from My Purchases after checkout (format matches the category above).',
    icon: fileIcon[cat] ?? '📄',
  }
}

export default function ListingDeliverablePreview({ listing }: { listing: Listing }) {
  const { title, line, detail, icon } = deliverableCopy(listing)

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-5 ring-1 ring-white/[0.04] sm:p-6"
      aria-label="Product type you are purchasing"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-400/90">Deliverable</p>
      <h3 className="mt-1 font-display text-lg font-normal tracking-tight text-white sm:text-xl">{title}</h3>
      <div className="mt-4 flex items-start gap-4 rounded-xl border border-white/[0.08] bg-slate-950/70 px-4 py-4 ring-1 ring-white/[0.05] sm:px-5 sm:py-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-2xl ring-1 ring-white/10 sm:h-16 sm:w-16 sm:text-3xl"
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-white sm:text-lg">{line}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{detail}</p>
        </div>
      </div>
    </section>
  )
}
