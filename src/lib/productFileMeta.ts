import type { Category, ListingType } from '@/lib/constants'

/** Infer marketplace format category from uploaded product filename (listing_type = file). */
export function inferCategoryFromProductFilename(filename: string): Category | null {
  const ext = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
  if (!ext) return null
  if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) return 'excel'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'docm', 'rtf', 'txt'].includes(ext)) return 'word'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'manuals'
  if (['exe', 'msi'].includes(ext)) return 'desktop_apps'
  return null
}

export function extensionFromFilename(filename: string | null | undefined): string | null {
  if (!filename?.trim()) return null
  const base = filename.trim().split(/[/\\]/).pop() ?? filename.trim()
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return null
  const ext = base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext ? `.${ext}` : null
}

/** Prefer stored original name; else last segment of storage path. */
export function displayProductFilename(listing: {
  product_original_filename?: string | null
  file_storage_path?: string | null
  app_bundle_path?: string | null
}): string | null {
  const stored = listing.product_original_filename?.trim()
  if (stored) return stored
  const p = listing.file_storage_path || listing.app_bundle_path
  if (!p?.trim()) return null
  const seg = p.split('/').pop()?.trim()
  return seg || null
}

function rawExtFromFilename(name: string | null | undefined): string {
  if (!name?.trim()) return ''
  const base = name.trim().split(/[/\\]/).pop() ?? name.trim()
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Short label for UI badges (deliverable type: Excel, PDF, Web app, EXE, …). */
export function productDeliverableBadge(input: {
  listingType: ListingType
  filenameForExt: string | null | undefined
  mimeType?: string | null
}): string {
  const mime = (input.mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') return 'PDF'
  if (
    mime.includes('spreadsheetml') ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv'
  ) {
    return mime === 'text/csv' ? 'CSV' : 'Excel'
  }
  if (mime.includes('wordprocessingml') || mime === 'application/msword') return 'Word'
  if (mime === 'application/rtf' || mime === 'text/rtf') return 'RTF'
  if (mime === 'text/plain') return 'Plain text'
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'ZIP'
  if (mime === 'text/html' || mime === 'application/xhtml+xml') return 'Web · HTML'

  const ext = rawExtFromFilename(input.filenameForExt)

  if (input.listingType === 'web_app') {
    if (ext === 'html' || ext === 'htm') return 'Web · HTML'
    if (ext === 'zip') return 'Web · ZIP'
    if (ext) return `Web · ${ext.toUpperCase()}`
    return 'Web app'
  }
  if (input.listingType === 'desktop_app') {
    if (ext === 'exe') return 'Windows · EXE'
    if (ext === 'msi') return 'Windows · MSI'
    if (ext) return `Installer · ${ext.toUpperCase()}`
    return 'Desktop app'
  }

  if (['xlsx', 'xls', 'xlsm'].includes(ext)) return 'Excel'
  if (ext === 'csv') return 'CSV'
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx', 'docm'].includes(ext)) return 'Word'
  if (ext === 'rtf') return 'RTF'
  if (ext === 'txt') return 'Plain text'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz'].includes(ext)) return 'Archive'
  if (ext === 'ppt' || ext === 'pptx' || ext === 'pptm') return 'PowerPoint'
  if (ext === 'json') return 'JSON'
  if (ext === 'xml') return 'XML'
  if (ext === 'html' || ext === 'htm') return 'Web · HTML'
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'JavaScript'
  if (ext === 'ts' || ext === 'tsx') return 'TypeScript'
  if (ext === 'py') return 'Python'
  if (ext === 'exe' || ext === 'msi') return ext === 'exe' ? 'Windows · EXE' : 'Windows · MSI'
  if (ext) return ext.toUpperCase()
  return 'File'
}
