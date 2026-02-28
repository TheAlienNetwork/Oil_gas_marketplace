import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Post, PostComment, Story } from '@/lib/types'
import { STORAGE_BUCKETS } from '@/lib/constants'

interface PostRow extends Post {
  like_count: number
  comment_count: number
  liked_by_me: boolean
}

export interface FeaturedAd {
  id: string
  title: string
  body: string | null
  image_url: string | null
  link_url: string | null
  active: boolean
  created_at: string
}

const STORY_DURATION_HOURS = 24

function PhotoVideoIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostRow[]>([])
  const [storiesByUser, setStoriesByUser] = useState<Map<string, Story[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [postContent, setPostContent] = useState('')
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null)
  const [postMediaType, setPostMediaType] = useState<'image' | 'video' | null>(null)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({})
  const [commentsVersion, setCommentsVersion] = useState<Record<string, number>>({})
  const [storyView, setStoryView] = useState<Story | null>(null)
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null)
  const [storyError, setStoryError] = useState<string | null>(null)
  const [addingStory, setAddingStory] = useState(false)
  const [featuredAds, setFeaturedAds] = useState<FeaturedAd[]>([])
  const postFileInputRef = useRef<HTMLInputElement>(null)
  const storyFileInputRef = useRef<HTMLInputElement>(null)

  const fetchStories = useCallback(async () => {
    const since = new Date(Date.now() - STORY_DURATION_HOURS * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('stories')
      .select('id, user_id, media_url, media_type, created_at, profiles(display_name, avatar_url)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const byUser = new Map<string, Story[]>()
    ;(data || []).forEach((s: Record<string, unknown>) => {
      const story = (s as unknown) as Story
      const list = byUser.get(story.user_id) || []
      list.push(story)
      byUser.set(story.user_id, list)
    })
    byUser.forEach((list) => list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setStoriesByUser(byUser)
  }, [])

  const fetchPosts = useCallback(async () => {
    let query = supabase
      .from('posts')
      .select(`
        id,
        user_id,
        content,
        image_url,
        video_url,
        created_at,
        updated_at,
        profiles (id, display_name, avatar_url, headline)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (user?.id) {
      const { data: connData } = await supabase
        .from('connections')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      const friendIds = new Set<string>([user.id])
      ;(connData || []).forEach((r: { sender_id: string; receiver_id: string }) => {
        friendIds.add(r.sender_id)
        friendIds.add(r.receiver_id)
      })
      friendIds.delete(user.id)
      const ids = [user.id, ...friendIds]
      query = query.in('user_id', ids)
    }

    const { data: postsData } = await query
    if (!postsData?.length) {
      setPosts([])
      setLoading(false)
      return
    }
    const postIds = postsData.map((p: { id: string }) => p.id)
    const [likesRes, commentsRes, myLikesRes] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('post_comments').select('post_id').in('post_id', postIds),
      user?.id
        ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
    ])
    const likeCountByPost: Record<string, number> = {}
    ;(likesRes.data || []).forEach((r: { post_id: string }) => {
      likeCountByPost[r.post_id] = (likeCountByPost[r.post_id] || 0) + 1
    })
    const commentCountByPost: Record<string, number> = {}
    ;(commentsRes.data || []).forEach((r: { post_id: string }) => {
      commentCountByPost[r.post_id] = (commentCountByPost[r.post_id] || 0) + 1
    })
    const myLikedIds = new Set((myLikesRes.data || []).map((r: { post_id: string }) => r.post_id))
    const rows: PostRow[] = postsData.map((p: Record<string, unknown>) => ({
      ...p,
      like_count: likeCountByPost[p.id as string] || 0,
      comment_count: commentCountByPost[p.id as string] || 0,
      liked_by_me: myLikedIds.has(p.id as string),
    })) as PostRow[]
    setPosts(rows)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])
  useEffect(() => {
    fetchStories()
  }, [fetchStories])
  useEffect(() => {
    supabase
      .from('featured_ads')
      .select('id, title, body, image_url, link_url, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(
      ({ data }) => { setFeaturedAds((data as FeaturedAd[]) || []); },
      () => { setFeaturedAds([]); }
    )
  }, [])

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    const hasContent = postContent.trim().length > 0 || postMediaFile
    if (!user?.id || !hasContent) return
    setPosting(true)
    setPostError(null)
    let image_url: string | null = null
    let video_url: string | null = null
    if (postMediaFile) {
      const ext = postMediaFile.name.split('.').pop() || 'bin'
      const isVideo = postMediaType === 'video' || postMediaFile.type.startsWith('video/')
      const path = `${user.id}/posts/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.feedMedia)
        .upload(path, postMediaFile, { upsert: false })
      if (upErr) {
        setPostError(`Upload failed: ${upErr.message}. Make sure the feed-media bucket exists and RLS allows uploads.`)
        setPosting(false)
        return
      }
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKETS.feedMedia).getPublicUrl(path)
      if (isVideo) video_url = urlData.publicUrl
      else image_url = urlData.publicUrl
    }
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content: postContent.trim() || '',
      image_url,
      video_url,
    })
    if (error) {
      setPostError(`Could not create post: ${error.message}. Ensure the posts table exists and RLS allows insert.`)
      setPosting(false)
      return
    }
    setPostContent('')
    setPostMediaFile(null)
    setPostMediaType(null)
    setPostError(null)
    await fetchPosts()
    setPosting(false)
  }

  const handleAddStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user?.id) return
    setStoryError(null)
    setAddingStory(true)
    const isVideo = file.type.startsWith('video/')
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
    const path = `${user.id}/stories/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKETS.feedMedia)
      .upload(path, file, { upsert: false })
    if (upErr) {
      setStoryError(`Story upload failed: ${upErr.message}. Ensure the feed-media bucket exists and storage allows uploads to your folder.`)
      setAddingStory(false)
      return
    }
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKETS.feedMedia).getPublicUrl(path)
    const { error: insertErr } = await supabase.from('stories').insert({
      user_id: user.id,
      media_url: urlData.publicUrl,
      media_type: isVideo ? 'video' : 'image',
    })
    if (insertErr) {
      setStoryError(`Could not add story: ${insertErr.message}. Ensure the stories table exists and RLS allows insert.`)
      setAddingStory(false)
      return
    }
    await fetchStories()
    setAddingStory(false)
  }

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user?.id) return
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              like_count: p.like_count + (liked ? -1 : 1),
              liked_by_me: !liked,
            }
          : p
      )
    )
  }

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  const handleAddComment = async (postId: string) => {
    const body = commentBodies[postId]?.trim()
    if (!user?.id || !body) return
    const { error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: user.id, body })
    if (!error) {
      setCommentBodies((prev) => ({ ...prev, [postId]: '' }))
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p))
      )
      setCommentsVersion((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }))
      if (!expandedComments.has(postId)) toggleComments(postId)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!user?.id) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id)
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const handleSharePost = async (postId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#post-${postId}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopiedId(postId)
      setTimeout(() => setShareCopiedId(null), 2000)
    } catch {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Feed</h1>
        <p className="text-slate-400 text-sm mt-0.5">Share updates and stay connected with the oil & gas community</p>
      </div>

      {/* Story carousel */}
      <div className="flex gap-5 overflow-x-auto pb-5 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent -mx-1">
        {user && (
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setStoryError(null); storyFileInputRef.current?.click() }}
              disabled={addingStory}
              className="flex flex-col items-center gap-1.5 disabled:opacity-60"
            >
              <div className="relative h-[72px] w-[72px] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:border-primary-500 hover:text-primary-400 hover:from-slate-600 hover:to-slate-700 transition-all">
                {addingStory ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                ) : (
                  <span className="text-2xl font-light">+</span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-medium">{addingStory ? 'Adding…' : 'Add story'}</span>
            </button>
            {storyError && (
              <p className="text-xs text-red-400 max-w-[140px] text-center">{storyError}</p>
            )}
            <input
              ref={storyFileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleAddStory}
            />
          </div>
        )}
        {Array.from(storiesByUser.entries()).map(([uid, list]) => {
          const latest = list[0]
          const profile = latest?.profiles as { display_name: string | null; avatar_url: string | null } | undefined
          return (
            <button
              key={uid}
              type="button"
              onClick={() => setStoryView(latest)}
              className="flex shrink-0 flex-col items-center gap-1 group"
            >
              <div className="h-[72px] w-[72px] rounded-full bg-gradient-to-br from-primary-500/80 to-primary-600 p-0.5 flex items-center justify-center overflow-hidden ring-2 ring-slate-800 group-hover:ring-primary-400/60 transition shadow-lg">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-slate-400">
                    {(profile?.display_name || uid).slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 truncate max-w-[72px]">
                {profile?.display_name || 'Someone'}
              </span>
            </button>
          )
        })}
      </div>

      {storyView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setStoryView(null)}
        >
          <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            {storyView.media_type === 'video' ? (
              <video src={storyView.media_url} controls autoPlay className="max-h-[90vh] rounded-lg" />
            ) : (
              <img src={storyView.media_url} alt="" className="max-h-[90vh] rounded-lg object-contain" />
            )}
            <button
              type="button"
              onClick={() => setStoryView(null)}
              className="mt-2 w-full rounded-lg bg-slate-700 py-2 text-sm text-white hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {user && (
        <form onSubmit={handleCreatePost} className="mb-4 rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 shadow-lg">
          {postError && (
            <div className="mb-2 rounded-lg bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300">
              {postError}
            </div>
          )}
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={2}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm text-white placeholder-slate-500 resize-none focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {postMediaFile && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
              {postMediaType === 'video' ? (
                <span>Video: {postMediaFile.name}</span>
              ) : (
                <span>Image: {postMediaFile.name}</span>
              )}
              <button type="button" onClick={() => { setPostMediaFile(null); setPostMediaType(null) }} className="text-red-400 hover:underline">
                Remove
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
            <input
              ref={postFileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setPostMediaFile(f)
                  setPostMediaType(f.type.startsWith('video/') ? 'video' : 'image')
                }
              }}
            />
            <button
              type="button"
              onClick={() => postFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition"
              title="Photo or video"
            >
              <PhotoVideoIcon />
              <span>Photo / Video</span>
            </button>
            <button
              type="submit"
              disabled={posting || (!postContent.trim() && !postMediaFile)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {!user && (
        <p className="mb-6 rounded-xl border border-slate-700 bg-slate-800/30 p-4 text-center text-slate-400">
          <Link to="/sign-in" className="text-primary-400 hover:underline">Sign in</Link> to post and interact.
        </p>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-8">Loading feed…</div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-500">
          No posts yet. Be the first to share!
        </div>
      ) : (
        <ul className="space-y-5">
          {(() => {
            type FeedItem = { type: 'post'; post: PostRow } | { type: 'ad'; ad: FeaturedAd }
            const items: FeedItem[] = []
            const adInterval = 6
            let adIndex = 0
            posts.forEach((post, i) => {
              items.push({ type: 'post', post })
              if (featuredAds.length > 0 && (i + 1) % adInterval === 0) {
                const ad = featuredAds[adIndex % featuredAds.length]
                adIndex += 1
                items.push({ type: 'ad', ad })
              }
            })
            return items.map((item, idx) =>
              item.type === 'post' ? (
                <PostCard
                  key={`post-${item.post.id}`}
                  post={item.post}
                  currentUserId={user?.id}
                  onLike={() => toggleLike(item.post.id, item.post.liked_by_me)}
                  expanded={expandedComments.has(item.post.id)}
                  onToggleComments={() => toggleComments(item.post.id)}
                  commentBody={commentBodies[item.post.id] || ''}
                  onCommentBodyChange={(v) => setCommentBodies((prev) => ({ ...prev, [item.post.id]: v }))}
                  onAddComment={() => handleAddComment(item.post.id)}
                  commentsVersion={commentsVersion[item.post.id] || 0}
                  onDelete={item.post.user_id === user?.id ? () => handleDeletePost(item.post.id) : undefined}
                  onShare={() => handleSharePost(item.post.id)}
                  shareCopied={shareCopiedId === item.post.id}
                />
              ) : (
                <FeaturedAdCard key={`ad-${item.ad.id}-${idx}`} ad={item.ad} />
              )
            )
          })()}
        </ul>
      )}
    </div>
  )
}

function FeaturedAdCard({ ad }: { ad: FeaturedAd }) {
  const inner = (
    <div className="p-4 sm:p-5">
      <span className="text-xs font-medium text-amber-400/90 uppercase tracking-wide">Sponsored</span>
      <h3 className="mt-1 font-semibold text-white">{ad.title}</h3>
      {ad.body && <p className="mt-1 text-sm text-slate-400 line-clamp-2">{ad.body}</p>}
      {ad.image_url && (
        <img src={ad.image_url} alt="" className="mt-3 rounded-xl w-full max-h-48 object-cover" />
      )}
      {ad.link_url && (
        <span className="mt-3 inline-block text-sm font-medium text-primary-400">Learn more →</span>
      )}
    </div>
  )
  return (
    <li className="rounded-2xl border border-amber-500/20 bg-slate-800/50 overflow-hidden shadow-lg shadow-black/10 list-none">
      {ad.link_url ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-95 transition">
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  )
}

function PostCard({
  post,
  currentUserId,
  onLike,
  expanded,
  onToggleComments,
  commentBody,
  onCommentBodyChange,
  onAddComment,
  commentsVersion,
  onDelete,
  onShare,
  shareCopied,
}: {
  post: PostRow
  currentUserId: string | undefined
  onLike: () => void
  expanded: boolean
  onToggleComments: () => void
  commentBody: string
  onCommentBodyChange: (v: string) => void
  onAddComment: () => void
  commentsVersion: number
  onDelete?: () => void
  onShare: () => void
  shareCopied: boolean
}) {
  const [comments, setComments] = useState<(PostComment & { profiles?: { display_name: string | null; avatar_url: string | null } })[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const author = post.profiles as { id: string; display_name: string | null; avatar_url: string | null; headline?: string | null } | undefined

  useEffect(() => {
    if (!expanded) return
    setCommentsLoading(true)
    supabase
      .from('post_comments')
      .select('id, post_id, user_id, body, created_at, profiles(display_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments(((data ?? []) as unknown) as (PostComment & { profiles?: { display_name: string | null; avatar_url: string | null } })[])
        setCommentsLoading(false)
      })
  }, [expanded, post.id, commentsVersion])

  const timeAgo = (date: string) => {
    const d = new Date(date)
    const sec = (Date.now() - d.getTime()) / 1000
    if (sec < 60) return 'Just now'
    if (sec < 3600) return `${Math.floor(sec / 60)}m`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`
    if (sec < 604800) return `${Math.floor(sec / 86400)}d`
    return d.toLocaleDateString()
  }

  return (
    <li id={`post-${post.id}`} className="rounded-xl border border-slate-700/80 bg-slate-800/50 overflow-hidden shadow-md hover:border-slate-600/80 transition">
      <div className="p-3 sm:p-4">
        <div className="flex gap-2.5">
          <Link to={`/profile/${post.user_id}`} className="shrink-0">
            {author?.avatar_url ? (
              <img
                src={author.avatar_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-600"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-xs font-semibold text-slate-300">
                {(author?.display_name || post.user_id).slice(0, 2).toUpperCase()}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={`/profile/${post.user_id}`} className="font-semibold text-white hover:underline">
                  {author?.display_name || 'Unnamed'}
                </Link>
                {author?.headline && (
                  <p className="text-xs text-slate-500">{author.headline}</p>
                )}
                <p className="text-xs text-slate-500">{timeAgo(post.created_at)}</p>
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition"
                  aria-label="Post menu"
                >
                  <span className="text-lg leading-none">⋯</span>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-slate-600 bg-slate-800 py-1 shadow-xl">
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); onDelete() }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700/80"
                        >
                          Delete post
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onShare() }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80"
                      >
                        Copy link
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {post.content ? (
          <p className="mt-2 whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">{post.content}</p>
        ) : null}
        {post.image_url && (
          <img
            src={post.image_url}
            alt=""
            className="mt-2 rounded-lg max-h-80 w-full object-cover"
          />
        )}
        {post.video_url && (
          <video
            src={post.video_url}
            controls
            className="mt-2 rounded-lg max-h-80 w-full bg-black"
          />
        )}
        <div className="mt-2 pt-2 flex items-center gap-1 border-t border-slate-700/80">
          <button
            type="button"
            onClick={onLike}
            disabled={!currentUserId}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${post.liked_by_me ? 'text-primary-400' : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'}`}
          >
            <span>{post.liked_by_me ? '👍' : '👍'}</span>
            <span>{post.liked_by_me ? 'Liked' : 'Like'}</span>
            {post.like_count > 0 && <span className="text-slate-500">· {post.like_count}</span>}
          </button>
          <button
            type="button"
            onClick={onToggleComments}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition"
          >
            <span>💬</span>
            <span>Comment</span>
            {post.comment_count > 0 && <span className="text-slate-500">· {post.comment_count}</span>}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition"
          >
            <span>🔗</span>
            <span>{shareCopied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-700/80 bg-slate-800/30 px-3 sm:px-4 py-3">
          {currentUserId && (
            <div className="flex gap-1.5 mb-3">
              <input
                value={commentBody}
                onChange={(e) => onCommentBodyChange(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onAddComment())}
              />
              <button
                type="button"
                onClick={onAddComment}
                disabled={!commentBody.trim()}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50 transition"
              >
                Reply
              </button>
            </div>
          )}
          {commentsLoading ? (
            <p className="text-sm text-slate-500">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-500">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-sm">
                  <Link to={`/profile/${c.user_id}`} className="font-medium text-slate-300 hover:underline">
                    {c.profiles?.display_name || 'Unnamed'}
                  </Link>
                  <span className="text-slate-400">{c.body}</span>
                  <span className="text-slate-500 text-xs">{timeAgo(c.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
