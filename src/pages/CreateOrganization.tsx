import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function CreateOrganization() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slug || slug === slugify(name)) setSlug(slugify(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setError('')
    setSubmitting(true)
    const finalSlug = slug || slugify(name)
    if (!finalSlug) {
      setError('Name is required.')
      setSubmitting(false)
      return
    }
    const { data, error: err } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        slug: finalSlug,
        description: description.trim() || null,
        owner_id: user.id,
      })
      .select('id')
      .single()
    if (err) {
      setError(err.message.includes('unique') ? 'That slug is already taken.' : err.message)
      setSubmitting(false)
      return
    }
    navigate(`/organizations/${data.id}`, { replace: true })
    setSubmitting(false)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-white">Create organization</h1>
      <p className="mt-1 text-slate-400">
        Set up a secure space for your team. Only members can see content.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="Acme Drilling"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-slate-300">
            URL slug
          </label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme-drilling"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
          <p className="mt-1 text-xs text-slate-500">Used in URLs; letters, numbers, hyphens only.</p>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-300">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Internal team space for well data and projects."
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/organizations')}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
