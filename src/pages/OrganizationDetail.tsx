import { Link, useParams, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type {
  Organization,
  OrganizationPost,
  OrganizationPostComment,
  OrganizationWellInfo,
  OrganizationFile,
  OrganizationMessage,
  OrganizationMember,
  Rig,
} from '@/lib/types'
import { STORAGE_BUCKETS } from '@/lib/constants'

type Tab = 'feed' | 'wells' | 'files' | 'messages' | 'rigs' | 'members'

export default function OrganizationDetail() {
  const { orgId } = useParams<{ orgId: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState<Organization | null>(null)
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('feed')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in', { replace: true })
      return
    }
    if (!user?.id || !orgId) return
    supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()
      .then(({ data: orgData, error: orgErr }) => {
        if (orgErr || !orgData) {
          setOrg(null)
          setLoading(false)
          return
        }
        setOrg(orgData as Organization)
        supabase
          .from('organization_members')
          .select('role')
          .eq('org_id', orgId)
          .eq('user_id', user.id)
          .single()
          .then(({ data: mem }) => {
            setMemberRole(mem?.role ?? null)
            setLoading(false)
          })
      })
  }, [orgId, user?.id, authLoading, user, navigate])

  if (authLoading || !user) return null
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-400">
        Loading…
      </div>
    )
  }
  if (!org) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-400">
        Organization not found.
      </div>
    )
  }
  if (!memberRole) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-slate-400">You don’t have access to this organization.</p>
        <Link to="/organizations" className="mt-4 inline-block text-primary-400 hover:underline">
          Back to organizations
        </Link>
      </div>
    )
  }

  const isAdmin = memberRole === 'owner' || memberRole === 'admin'
  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'wells', label: 'Well info' },
    { id: 'files', label: 'Files' },
    { id: 'messages', label: 'Messages' },
    { id: 'rigs', label: 'Active rigs' },
    { id: 'members', label: 'Members' },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex items-center gap-4">
          {org.logo_url ? (
            <img src={org.logo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-700 text-2xl font-semibold text-slate-400">
              {org.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-white">{org.name}</h1>
            {org.description && <p className="text-slate-400">{org.description}</p>}
            <p className="text-xs text-slate-500 capitalize">You are {memberRole}</p>
          </div>
        </div>
      </div>

      <nav className="mt-6 flex gap-2 border-b border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-primary-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'feed' && <OrgFeed orgId={org.id} userId={user.id} />}
        {tab === 'wells' && <OrgWells orgId={org.id} userId={user.id} />}
        {tab === 'files' && <OrgFiles orgId={org.id} userId={user.id} />}
        {tab === 'messages' && <OrgMessages orgId={org.id} userId={user.id} />}
        {tab === 'rigs' && <OrgRigs orgId={org.id} userId={user.id} isAdmin={isAdmin} />}
        {tab === 'members' && <OrgMembers orgId={org.id} currentUserId={user.id} isAdmin={isAdmin} />}
      </div>
    </div>
  )
}

function OrgFeed({ orgId, userId }: { orgId: string; userId: string }) {
  const [posts, setPosts] = useState<(OrganizationPost & { comment_count?: number })[]>([])
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({})

  const fetchPosts = useCallback(() => {
    supabase
      .from('organization_posts')
      .select('id, org_id, user_id, content, image_url, created_at, profiles(display_name, avatar_url)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(async ({ data: postsData }) => {
        if (!postsData?.length) {
          setPosts([])
          return
        }
        const counts = await Promise.all(
          postsData.map((p: { id: string }) =>
            supabase
              .from('organization_post_comments')
              .select('id', { count: 'exact', head: true })
              .eq('post_id', p.id)
          )
        )
        const list = postsData.map((p: Record<string, unknown>, i: number) => ({
          ...p,
          comment_count: counts[i].count ?? 0,
        })) as (OrganizationPost & { comment_count?: number })[]
        setPosts(list)
      })
  }, [orgId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    await supabase.from('organization_posts').insert({ org_id: orgId, user_id: userId, content: content.trim() })
    setContent('')
    fetchPosts()
    setPosting(false)
  }

  const toggleComments = (postId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  const handleComment = async (postId: string) => {
    const body = commentBodies[postId]?.trim()
    if (!body) return
    await supabase.from('organization_post_comments').insert({ post_id: postId, user_id: userId, body })
    setCommentBodies((prev) => ({ ...prev, [postId]: '' }))
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p))
    )
    if (!expanded.has(postId)) setExpanded((prev) => new Set(prev).add(postId))
  }

  const timeAgo = (date: string) => {
    const d = new Date(date)
    const sec = (Date.now() - d.getTime()) / 1000
    if (sec < 60) return 'Just now'
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handlePost} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an achievement or update..."
          rows={3}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={posting || !content.trim()}
          className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
        >
          Post
        </button>
      </form>
      {posts.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-500">
          No posts yet. Share an achievement or update.
        </p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => {
            const author = post.profiles as { display_name: string | null; avatar_url: string | null } | undefined
            return (
              <li key={post.id} className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
                <div className="p-4">
                  <div className="flex gap-3">
                    {author?.avatar_url ? (
                      <img src={author.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-600 text-sm text-slate-300">
                        {(author?.display_name || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">{author?.display_name || 'Someone'}</p>
                      <p className="text-xs text-slate-500">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-slate-200">{post.content}</p>
                  <button
                    type="button"
                    onClick={() => toggleComments(post.id)}
                    className="mt-2 text-sm text-slate-400 hover:text-white"
                  >
                    💬 Comment {post.comment_count ? `(${post.comment_count})` : ''}
                  </button>
                </div>
                {expanded.has(post.id) && (
                  <OrgPostComments
                    postId={post.id}
                    commentBody={commentBodies[post.id] ?? ''}
                    onCommentBodyChange={(v) => setCommentBodies((prev) => ({ ...prev, [post.id]: v }))}
                    onAddComment={() => handleComment(post.id)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function OrgPostComments({
  postId,
  commentBody,
  onCommentBodyChange,
  onAddComment,
}: {
  postId: string
  commentBody: string
  onCommentBodyChange: (v: string) => void
  onAddComment: () => void
}) {
  const [comments, setComments] = useState<(OrganizationPostComment & { profiles?: { display_name: string | null } })[]>([])
  useEffect(() => {
    supabase
      .from('organization_post_comments')
      .select('id, post_id, body, created_at, user_id, profiles(display_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments(((data ?? []) as unknown) as (OrganizationPostComment & { profiles?: { display_name: string | null } })[]))
  }, [postId])
  const timeAgo = (date: string) => {
    const d = new Date(date)
    const sec = (Date.now() - d.getTime()) / 1000
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    return d.toLocaleDateString()
  }
  return (
    <div className="border-t border-slate-700 bg-slate-800/30 p-4">
      <div className="flex gap-2 mb-3">
        <input
          value={commentBody}
          onChange={(e) => onCommentBodyChange(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={onAddComment}
          disabled={!commentBody.trim()}
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
        >
          Reply
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {comments.map((c) => (
          <li key={c.id}>
            <span className="font-medium text-slate-300">{(c.profiles as { display_name: string | null })?.display_name || 'Someone'}</span>
            {' '}
            <span className="text-slate-400">{c.body}</span>
            <span className="text-slate-500 text-xs ml-2">{timeAgo(c.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OrgWells({ orgId, userId }: { orgId: string; userId: string }) {
  const [wells, setWells] = useState<OrganizationWellInfo[]>([])
  const [adding, setAdding] = useState(false)
  const [wellName, setWellName] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const fetch = useCallback(() => {
    supabase
      .from('organization_well_info')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setWells((data as OrganizationWellInfo[]) ?? []))
  }, [orgId])
  useEffect(() => { fetch() }, [fetch])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wellName.trim()) return
    await supabase
      .from('organization_well_info')
      .insert({
        org_id: orgId,
        well_name: wellName.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        created_by: userId,
      })
    setWellName('')
    setLocation('')
    setNotes('')
    setAdding(false)
    fetch()
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setAdding(!adding)}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500"
      >
        {adding ? 'Cancel' : 'Add well'}
      </button>
      {adding && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3">
          <input
            value={wellName}
            onChange={(e) => setWellName(e.target.value)}
            placeholder="Well name *"
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
          <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500">
            Save
          </button>
        </form>
      )}
      {wells.length === 0 && !adding ? (
        <p className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-500">
          No well information yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {wells.map((w) => (
            <li key={w.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="font-medium text-white">{w.well_name}</p>
              {w.location && <p className="text-sm text-slate-400">{w.location}</p>}
              {w.notes && <p className="mt-1 text-sm text-slate-500">{w.notes}</p>}
              <p className="mt-2 text-xs text-slate-500">{new Date(w.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OrgFiles({ orgId, userId }: { orgId: string; userId: string }) {
  const [files, setFiles] = useState<OrganizationFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetch = useCallback(() => {
    supabase
      .from('organization_files')
      .select('id, org_id, file_name, storage_path, file_size, mime_type, uploaded_by, created_at, profiles(display_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setFiles(((data ?? []) as unknown) as OrganizationFile[]))
  }, [orgId])
  useEffect(() => { fetch() }, [fetch])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${orgId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKETS.organizationFiles)
      .upload(path, file, { upsert: false })
    if (upErr) {
      setUploading(false)
      return
    }
    await supabase.from('organization_files').insert({
      org_id: orgId,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: userId,
    })
    fetch()
    setUploading(false)
    e.target.value = ''
  }

  const handleDownload = async (file: OrganizationFile) => {
    const { data } = await supabase.storage
      .from(STORAGE_BUCKETS.organizationFiles)
      .createSignedUrl(file.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleUpload}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload file'}
        </button>
      </div>
      {files.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-500">
          No files yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
            >
              <span className="truncate text-slate-200">{f.file_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {f.file_size != null && (
                  <span className="text-xs text-slate-500">
                    {(f.file_size / 1024).toFixed(1)} KB
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDownload(f)}
                  className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                >
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OrgMessages({ orgId, userId }: { orgId: string; userId: string }) {
  const [messages, setMessages] = useState<(OrganizationMessage & { profiles?: { display_name: string | null } })[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const fetch = useCallback(() => {
    supabase
      .from('organization_messages')
      .select('id, org_id, sender_id, body, created_at, profiles(display_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(((data ?? []) as unknown) as (OrganizationMessage & { profiles?: { display_name: string | null } })[]))
  }, [orgId])
  useEffect(() => { fetch() }, [fetch])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    await supabase.from('organization_messages').insert({ org_id: orgId, sender_id: userId, body: body.trim() })
    setBody('')
    fetch()
    setSending(false)
  }

  const timeAgo = (date: string) => {
    const d = new Date(date)
    const sec = (Date.now() - d.getTime()) / 1000
    if (sec < 3600) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleString()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 flex flex-col max-h-96">
        <ul className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <li className="text-center text-slate-500 text-sm">No messages yet. Say hello!</li>
          ) : (
            messages.map((m) => (
              <li key={m.id} className="flex gap-2">
                <span className="shrink-0 font-medium text-slate-400">
                  {(m.profiles as { display_name: string | null })?.display_name || 'Someone'}:
                </span>
                <span className="text-slate-200">{m.body}</span>
                <span className="shrink-0 text-xs text-slate-500">{timeAgo(m.created_at)}</span>
              </li>
            ))
          )}
        </ul>
        <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-slate-700">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message the team..."
            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

function OrgMembers({
  orgId,
  currentUserId,
  isAdmin,
}: {
  orgId: string
  currentUserId: string
  isAdmin: boolean
}) {
  const [members, setMembers] = useState<(OrganizationMember & { profiles?: { display_name: string | null; avatar_url: string | null } })[]>([])
  const [addUserId, setAddUserId] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const fetch = useCallback(() => {
    supabase
      .from('organization_members')
      .select('org_id, user_id, role, joined_at, profiles(display_name, avatar_url)')
      .eq('org_id', orgId)
      .then(({ data }) => setMembers(((data ?? []) as unknown) as (OrganizationMember & { profiles?: { display_name: string | null; avatar_url: string | null } })[]))
  }, [orgId])
  useEffect(() => { fetch() }, [fetch])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const uid = addUserId.trim()
    if (!uid) return
    setError('')
    setAdding(true)
    const { error: err } = await supabase
      .from('organization_members')
      .insert({ org_id: orgId, user_id: uid, role: 'member' })
    if (err) setError(err.message.includes('duplicate') ? 'Already a member.' : err.message)
    else {
      setAddUserId('')
      fetch()
    }
    setAdding(false)
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member?')) return
    await supabase.from('organization_members').delete().eq('org_id', orgId).eq('user_id', userId)
    fetch()
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="add-user-id" className="block text-xs text-slate-500 mb-1">
              Add member by user ID (from their profile URL)
            </label>
            <input
              id="add-user-id"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              placeholder="uuid"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !addUserId.trim()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
          >
            Add
          </button>
          {error && <p className="w-full text-sm text-red-400">{error}</p>}
        </form>
      )}
      <ul className="space-y-2">
        {members.map((m) => {
          const profile = m.profiles as { display_name: string | null; avatar_url: string | null } | undefined
          return (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-300">
                    {(profile?.display_name || m.user_id).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-200">{profile?.display_name || 'Unnamed'}</p>
                  <p className="text-xs text-slate-500 capitalize">{m.role}</p>
                </div>
              </div>
              {isAdmin && m.role !== 'owner' && m.user_id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.user_id)}
                  className="text-sm text-slate-500 hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function OrgRigs({
  orgId,
  userId,
  isAdmin,
}: {
  orgId: string
  userId: string
  isAdmin: boolean
}) {
  const [rigs, setRigs] = useState<Rig[]>([])
  const [joinedRigIds, setJoinedRigIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [rigName, setRigName] = useState('')
  const [rigDescription, setRigDescription] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase
        .from('rigs')
        .select('id, org_id, name, description, created_at, updated_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase.from('rig_members').select('rig_id').eq('user_id', userId),
    ]).then(([rigsRes, memRes]) => {
      setRigs((rigsRes.data as Rig[]) ?? [])
      const ids = new Set((memRes.data ?? []).map((m: { rig_id: string }) => m.rig_id))
      setJoinedRigIds(ids)
      setLoading(false)
    })
  }, [orgId, userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const handleJoin = async (rigId: string) => {
    await supabase.from('rig_members').insert({ rig_id: rigId, user_id: userId })
    setJoinedRigIds((prev) => new Set(prev).add(rigId))
  }

  const handleLeave = async (rigId: string) => {
    if (!confirm('Leave this rig?')) return
    await supabase.from('rig_members').delete().eq('rig_id', rigId).eq('user_id', userId)
    setJoinedRigIds((prev) => {
      const next = new Set(prev)
      next.delete(rigId)
      return next
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rigName.trim()) return
    setCreating(true)
    await supabase.from('rigs').insert({
      org_id: orgId,
      name: rigName.trim(),
      description: rigDescription.trim() || null,
    })
    setRigName('')
    setRigDescription('')
    fetch()
    setCreating(false)
  }

  return (
    <div className="space-y-6">
      <p className="text-slate-400">
        Join rigs to work in smaller teams. Each rig has its own feed and message hub for the crew.
      </p>
      {isAdmin && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 flex flex-wrap gap-3 items-end">
          <input
            value={rigName}
            onChange={(e) => setRigName(e.target.value)}
            placeholder="Rig name"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
          <input
            value={rigDescription}
            onChange={(e) => setRigDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white flex-1 min-w-[200px]"
          />
          <button
            type="submit"
            disabled={creating || !rigName.trim()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
          >
            Create rig
          </button>
        </form>
      )}
      {loading ? (
        <p className="text-slate-500">Loading rigs…</p>
      ) : rigs.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-500">
          No rigs yet. {isAdmin ? 'Create one above.' : 'Ask an org admin to create a rig.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {rigs.map((rig) => {
            const joined = joinedRigIds.has(rig.id)
            return (
              <li
                key={rig.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/organizations/${orgId}/rigs/${rig.id}`}
                    className="font-medium text-white hover:underline"
                  >
                    {rig.name}
                  </Link>
                  {rig.description && (
                    <p className="text-sm text-slate-500 truncate">{rig.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {joined ? (
                    <>
                      <Link
                        to={`/organizations/${orgId}/rigs/${rig.id}`}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-500"
                      >
                        Open hub
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleLeave(rig.id)}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700"
                      >
                        Leave
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleJoin(rig.id)}
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-500"
                    >
                      Join rig
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
