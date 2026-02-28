import { Link, useParams, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Rig, RigPost, RigPostComment, RigMessage } from '@/lib/types'

export default function RigDetail() {
  const { orgId, rigId } = useParams<{ orgId: string; rigId: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [rig, setRig] = useState<Rig | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in', { replace: true })
      return
    }
    if (!user?.id || !orgId || !rigId) return
    supabase
      .from('rigs')
      .select('id, org_id, name, description, created_at, updated_at')
      .eq('id', rigId)
      .eq('org_id', orgId)
      .single()
      .then(({ data: rigData, error: rigErr }) => {
        if (rigErr || !rigData) {
          setRig(null)
          setLoading(false)
          return
        }
        setRig(rigData as Rig)
        supabase
          .from('rig_members')
          .select('rig_id')
          .eq('rig_id', rigId)
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data: mem }) => {
            setIsMember(!!mem)
            setLoading(false)
          })
      })
  }, [orgId, rigId, user?.id, authLoading, user, navigate])

  const handleJoin = async () => {
    if (!user?.id || !rigId) return
    await supabase.from('rig_members').insert({ rig_id: rigId, user_id: user.id })
    setIsMember(true)
  }

  if (authLoading || !user) return null
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-400">
        Loading…
      </div>
    )
  }
  if (!rig) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-400">
        Rig not found.
      </div>
    )
  }
  if (!isMember) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-slate-400">Join this rig to access the crew hub.</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={handleJoin}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500"
          >
            Join rig
          </button>
          <Link
            to={`/organizations/${orgId}`}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Back to organization
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to={`/organizations/${orgId}`}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Organization
        </Link>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 mb-6">
        <h1 className="text-xl font-semibold text-white">{rig.name}</h1>
        {rig.description && <p className="mt-1 text-slate-400">{rig.description}</p>}
        <p className="mt-2 text-xs text-slate-500">Crew hub — feed and messages for this rig only.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <h2 className="p-4 border-b border-slate-700 text-sm font-semibold text-white">
            Feed
          </h2>
          <RigFeed rigId={rig.id} userId={user.id} />
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden flex flex-col">
          <h2 className="p-4 border-b border-slate-700 text-sm font-semibold text-white">
            Messages
          </h2>
          <RigMessages rigId={rig.id} userId={user.id} />
        </section>
      </div>
    </div>
  )
}

function RigFeed({ rigId, userId }: { rigId: string; userId: string }) {
  const [posts, setPosts] = useState<(RigPost & { comment_count?: number })[]>([])
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({})

  const fetchPosts = useCallback(() => {
    supabase
      .from('rig_posts')
      .select('id, rig_id, user_id, content, image_url, created_at, profiles(display_name, avatar_url)')
      .eq('rig_id', rigId)
      .order('created_at', { ascending: false })
      .then(async ({ data: postsData }) => {
        if (!postsData?.length) {
          setPosts([])
          return
        }
        const counts = await Promise.all(
          postsData.map((p: { id: string }) =>
            supabase
              .from('rig_post_comments')
              .select('id', { count: 'exact', head: true })
              .eq('post_id', p.id)
          )
        )
        const list = postsData.map((p: Record<string, unknown>, i: number) => ({
          ...p,
          comment_count: counts[i].count ?? 0,
        })) as (RigPost & { comment_count?: number })[]
        setPosts(list)
      })
  }, [rigId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    await supabase.from('rig_posts').insert({ rig_id: rigId, user_id: userId, content: content.trim() })
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
    await supabase.from('rig_post_comments').insert({ post_id: postId, user_id: userId, body })
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
    <div className="flex flex-col max-h-[500px]">
      <form onSubmit={handlePost} className="p-4 border-b border-slate-700 shrink-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an update with the crew..."
          rows={2}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 resize-none"
        />
        <button
          type="submit"
          disabled={posting || !content.trim()}
          className="mt-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
        >
          Post
        </button>
      </form>
      <ul className="flex-1 overflow-y-auto p-4 space-y-3">
        {posts.length === 0 ? (
          <li className="text-center text-slate-500 text-sm py-4">No posts yet.</li>
        ) : (
          posts.map((post) => {
            const author = post.profiles as { display_name: string | null; avatar_url: string | null } | undefined
            return (
              <li key={post.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex gap-2">
                  {author?.avatar_url ? (
                    <img src={author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-300 shrink-0">
                      {(author?.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm">{author?.display_name || 'Someone'}</p>
                    <p className="text-xs text-slate-500">{timeAgo(post.created_at)}</p>
                    <p className="mt-1 text-slate-200 text-sm whitespace-pre-wrap">{post.content}</p>
                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className="mt-1 text-xs text-slate-400 hover:text-white"
                    >
                      💬 Comment {post.comment_count ? `(${post.comment_count})` : ''}
                    </button>
                  </div>
                </div>
                {expanded.has(post.id) && (
                  <RigPostComments
                    postId={post.id}
                    commentBody={commentBodies[post.id] ?? ''}
                    onCommentBodyChange={(v) => setCommentBodies((prev) => ({ ...prev, [post.id]: v }))}
                    onAddComment={() => handleComment(post.id)}
                  />
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

function RigPostComments({
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
  const [comments, setComments] = useState<(RigPostComment & { profiles?: { display_name: string | null } })[]>([])
  useEffect(() => {
    supabase
      .from('rig_post_comments')
      .select('id, post_id, body, created_at, user_id, profiles(display_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments(((data ?? []) as unknown) as (RigPostComment & { profiles?: { display_name: string | null } })[]))
  }, [postId])
  const timeAgo = (date: string) => {
    const d = new Date(date)
    const sec = (Date.now() - d.getTime()) / 1000
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    return d.toLocaleDateString()
  }
  return (
    <div className="mt-3 pt-3 border-t border-slate-700">
      <div className="flex gap-2 mb-2">
        <input
          value={commentBody}
          onChange={(e) => onCommentBodyChange(e.target.value)}
          placeholder="Comment..."
          className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
        />
        <button
          type="button"
          onClick={onAddComment}
          disabled={!commentBody.trim()}
          className="rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500 disabled:opacity-50"
        >
          Reply
        </button>
      </div>
      <ul className="space-y-1 text-xs">
        {comments.map((c) => (
          <li key={c.id}>
            <span className="font-medium text-slate-300">{(c.profiles as { display_name: string | null })?.display_name || 'Someone'}</span>
            {' '}
            <span className="text-slate-400">{c.body}</span>
            <span className="text-slate-500 ml-1">{timeAgo(c.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RigMessages({ rigId, userId }: { rigId: string; userId: string }) {
  const [messages, setMessages] = useState<(RigMessage & { profiles?: { display_name: string | null } })[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetch = useCallback(() => {
    supabase
      .from('rig_messages')
      .select('id, rig_id, sender_id, body, created_at, profiles(display_name)')
      .eq('rig_id', rigId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(((data ?? []) as unknown) as (RigMessage & { profiles?: { display_name: string | null } })[]))
  }, [rigId])
  useEffect(() => {
    fetch()
  }, [fetch])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    await supabase.from('rig_messages').insert({ rig_id: rigId, sender_id: userId, body: body.trim() })
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
    <div className="flex flex-col max-h-[500px]">
      <ul className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <li className="text-center text-slate-500 text-sm py-4">No messages yet. Say something!</li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-slate-400">
                {(m.profiles as { display_name: string | null })?.display_name || 'Someone'}:
              </span>
              <span className="text-slate-200">{m.body}</span>
              <span className="shrink-0 text-xs text-slate-500">{timeAgo(m.created_at)}</span>
            </li>
          ))
        )}
        <div ref={bottomRef} />
      </ul>
      <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-slate-700 shrink-0">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message the crew..."
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
