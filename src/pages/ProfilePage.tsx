import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Profile, WorkExperience, ProfileProject, Post, Connection } from '@/lib/types'
import { STORAGE_BUCKETS } from '@/lib/constants'
import { ResponsiveBar } from '@nivo/bar'

const DAYS = 7

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>()
  const { user, refreshProfile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [work, setWork] = useState<WorkExperience[]>([])
  const [projects, setProjects] = useState<ProfileProject[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [openToWork, setOpenToWork] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [connectionCount, setConnectionCount] = useState(0)
  const [profileViewsData, setProfileViewsData] = useState<{ day: string; views: number }[]>([])
  const [viewsLoading, setViewsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'experience' | 'projects' | 'posts'>('experience')
  const [experienceError, setExperienceError] = useState<string | null>(null)
  const [addingExperience, setAddingExperience] = useState(false)

  const profileId = userId || user?.id
  const isOwnProfile = !!user?.id && profileId === user.id

  useEffect(() => {
    if (!userId && !authLoading && !user) {
      navigate('/sign-in', { replace: true })
      return
    }
  }, [userId, authLoading, user, navigate])

  const fetchProfileViews = useCallback(async (pid: string) => {
    setViewsLoading(true)
    const start = new Date()
    start.setDate(start.getDate() - DAYS)
    start.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('profile_views')
      .select('viewed_at')
      .eq('profile_id', pid)
      .gte('viewed_at', start.toISOString())
    const byDay: Record<string, number> = {}
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      byDay[d.toISOString().slice(0, 10)] = 0
    }
    ;(data || []).forEach((r: { viewed_at: string }) => {
      const day = r.viewed_at.slice(0, 10)
      if (byDay[day] !== undefined) byDay[day]++
    })
    setProfileViewsData(
      Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, views]) => ({ day: day.slice(5), views }))
    )
    setViewsLoading(false)
  }, [])

  useEffect(() => {
    if (!profileId) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('work_experience').select('*').eq('user_id', profileId).order('start_date', { ascending: false }),
      supabase.from('profile_projects').select('*').eq('user_id', profileId).order('created_at', { ascending: false }),
      supabase.from('posts').select('id, user_id, content, image_url, video_url, created_at').eq('user_id', profileId).order('created_at', { ascending: false }).limit(20),
    ]).then(([p, w, pr, po]) => {
      if (p.data) {
        setProfile(p.data as Profile)
        setDisplayName((p.data as Profile).display_name || '')
        setHeadline((p.data as Profile).headline || '')
        setBio((p.data as Profile).bio || '')
        setLocation((p.data as Profile).location || '')
        setOpenToWork((p.data as Profile).open_to_work ?? false)
      }
      if (w.data) setWork(w.data as WorkExperience[])
      else setWork([])
      if (pr.data) setProjects(pr.data as ProfileProject[])
      else setProjects([])
      if (po.data) setPosts(po.data as Post[])
      else setPosts([])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [profileId])

  useEffect(() => {
    if (!profileId || !user?.id) return
    if (profileId !== user.id) {
      supabase.from('profile_views').insert({ viewer_id: user.id, profile_id: profileId }).then(() => {})
    }
  }, [profileId, user?.id])

  useEffect(() => {
    if (!profileId || !user?.id) return
    Promise.all([
      supabase
        .from('connections')
        .select('id, sender_id, receiver_id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${user.id})`)
        .maybeSingle(),
      supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`),
    ]).then(([conn, count]) => {
      if (conn.data) {
        const c = conn.data as Connection
        if (c.status === 'accepted') setConnectionStatus('accepted')
        else if (c.sender_id === user.id) setConnectionStatus('pending_sent')
        else setConnectionStatus('pending_received')
        setConnectionId(c.id)
      } else setConnectionStatus('none')
      setConnectionCount(count.count ?? 0)
    })
  }, [profileId, user?.id])

  useEffect(() => {
    if (isOwnProfile && profileId) fetchProfileViews(profileId)
  }, [isOwnProfile, profileId, fetchProfileViews])

  const handleSaveProfile = async () => {
    if (!user?.id || profileId !== user.id) return
    setSaving(true)
    setSaveError(null)
    let avatarUrl = profile?.avatar_url || null
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop() || 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.profileAvatars)
        .upload(path, avatarFile, { upsert: true })
      if (upErr) {
        setSaveError(`Profile photo upload failed: ${upErr.message}. Ensure the profile-avatars bucket exists and storage policies allow upload.`)
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKETS.profileAvatars).getPublicUrl(path)
      avatarUrl = urlData.publicUrl
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        headline: headline || null,
        bio: bio || null,
        location: location || null,
        open_to_work: openToWork,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) {
      setSaveError(`Could not save profile: ${error.message}`)
      setSaving(false)
      return
    }
    setProfile((prev) => (prev ? { ...prev, display_name: displayName || null, headline: headline || null, bio: bio || null, location: location || null, open_to_work: openToWork, avatar_url: avatarUrl } : null))
    refreshProfile()
    setEditing(false)
    setAvatarFile(null)
    setSaveError(null)
    setSaving(false)
  }

  const handleConnect = async () => {
    if (!user?.id || profileId === user.id || !profileId) return
    await supabase.from('connections').insert({ sender_id: user.id, receiver_id: profileId, status: 'pending' })
    setConnectionStatus('pending_sent')
  }

  const handleAcceptConnection = async () => {
    if (!connectionId || !user?.id) return
    await supabase.from('connections').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', connectionId)
    setConnectionStatus('accepted')
    setConnectionCount((c) => c + 1)
  }

  const handleIgnoreConnection = async () => {
    if (!connectionId) return
    await supabase.from('connections').delete().eq('id', connectionId)
    setConnectionStatus('none')
    setConnectionId(null)
  }

  const handleAddExperience = async (e: React.FormEvent) => {
    e.preventDefault()
    setExperienceError(null)
    if (!user?.id) return
    const form = e.target as HTMLFormElement
    const company = (form.querySelector('[name=company]') as HTMLInputElement)?.value?.trim()
    const job_title = (form.querySelector('[name=job_title]') as HTMLInputElement)?.value?.trim()
    const loc = (form.querySelector('[name=location]') as HTMLInputElement)?.value?.trim() || null
    const start_date = (form.querySelector('[name=start_date]') as HTMLInputElement)?.value
    const end_date = (form.querySelector('[name=end_date]') as HTMLInputElement)?.value
    const is_current = (form.querySelector('[name=is_current]') as HTMLInputElement)?.checked
    const description = (form.querySelector('[name=description]') as HTMLTextAreaElement)?.value?.trim() || null
    if (!company || !job_title || !start_date) {
      setExperienceError('Company, job title, and start date are required.')
      return
    }
    setAddingExperience(true)
    const { data, error } = await supabase
      .from('work_experience')
      .insert({
        user_id: user.id,
        company,
        job_title,
        location: loc,
        start_date,
        end_date: is_current ? null : end_date || null,
        is_current: !!is_current,
        description,
      })
      .select()
      .single()
    setAddingExperience(false)
    if (error) {
      setExperienceError(error.message || 'Failed to add experience. Try again.')
      return
    }
    if (data) setWork((prev) => [data as WorkExperience, ...prev])
    form.reset()
  }

  const handleDeleteExperience = async (id: string) => {
    if (!user?.id) return
    await supabase.from('work_experience').delete().eq('id', id).eq('user_id', user.id)
    setWork((prev) => prev.filter((w) => w.id !== id))
  }

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    const form = e.target as HTMLFormElement
    const title = (form.querySelector('[name=title]') as HTMLInputElement)?.value
    const description = (form.querySelector('[name=project_description]') as HTMLTextAreaElement)?.value
    const url = (form.querySelector('[name=url]') as HTMLInputElement)?.value
    const { data } = await supabase
      .from('profile_projects')
      .insert({ user_id: user.id, title, description: description || null, url: url || null })
      .select()
      .single()
    if (data) setProjects((prev) => [data as ProfileProject, ...prev])
    form.reset()
  }

  const handleDeleteProject = async (id: string) => {
    if (!user?.id) return
    await supabase.from('profile_projects').delete().eq('id', id).eq('user_id', user.id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  if (authLoading || !user) return null
  if (loading) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="mt-4 text-slate-400">Loading profile…</p>
        </div>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-400">
        Profile not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover ring-2 ring-slate-600" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700 text-2xl font-semibold text-slate-400">
                {(profile.display_name || profile.id).slice(0, 2).toUpperCase()}
              </div>
            )}
            {isOwnProfile && editing && (
              <label className="mt-2 block cursor-pointer text-center text-xs text-primary-400 hover:underline">
                Change photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isOwnProfile && editing ? (
              <>
                {saveError && (
                  <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                    {saveError}
                  </div>
                )}
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-lg font-semibold text-white placeholder-slate-500" />
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline (e.g. Drilling Engineer)" className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 placeholder-slate-500" />
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 placeholder-slate-500" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Houston, TX)" className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 placeholder-slate-500" />
                <label className="mt-2 flex items-center gap-2 text-slate-300">
                  <input type="checkbox" checked={openToWork} onChange={(e) => setOpenToWork(e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-primary-600" />
                  Open to work (visible on Talent)
                </label>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={handleSaveProfile} disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-white">{profile.display_name || 'Unnamed'}</h1>
                {profile.headline && <p className="mt-1 text-slate-400">{profile.headline}</p>}
                {profile.bio && <p className="mt-2 text-sm text-slate-400 whitespace-pre-wrap">{profile.bio}</p>}
                {(profile as Profile & { location?: string | null }).location && <p className="mt-1 text-sm text-slate-500">{(profile as Profile & { location?: string | null }).location}</p>}
                {(profile as Profile & { open_to_work?: boolean }).open_to_work && <span className="mt-2 inline-block rounded bg-primary-600/20 px-2 py-0.5 text-xs text-primary-400">Open to work</span>}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isOwnProfile ? (
                    <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Edit profile</button>
                  ) : (
                    <>
                      {connectionStatus === 'none' && <button type="button" onClick={handleConnect} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500">Connect</button>}
                      {connectionStatus === 'pending_sent' && <span className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-500">Pending</span>}
                      {connectionStatus === 'pending_received' && (
                        <>
                          <button type="button" onClick={handleAcceptConnection} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500">Accept</button>
                          <button type="button" onClick={handleIgnoreConnection} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700">Ignore</button>
                        </>
                      )}
                      {connectionStatus === 'accepted' && <Link to="/messages" className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">Message</Link>}
                    </>
                  )}
                  <span className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400">{connectionCount} connections</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Analytics (own profile only) */}
      {isOwnProfile && (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="text-lg font-semibold text-white">Profile views</h2>
          <p className="text-sm text-slate-500">Last 7 days</p>
          {viewsLoading ? (
            <div className="mt-4 h-52 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /></div>
          ) : (
            <div className="mt-4 h-52">
              <ResponsiveBar
                data={profileViewsData}
                keys={['views']}
                indexBy="day"
                margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
                padding={0.35}
                valueScale={{ type: 'linear' }}
                colors={{ scheme: 'nivo' }}
                theme={{
                  text: { fill: '#94a3b8', fontSize: 11 },
                  axis: { domain: { line: { stroke: '#475569' } }, ticks: { line: { stroke: '#475569' } } },
                }}
                axisBottom={{ tickSize: 0, tickPadding: 10 }}
                axisLeft={{ tickSize: 0, tickPadding: 8 }}
                enableGridY={false}
                animate={true}
                motionConfig="gentle"
              />
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8">
        <div className="flex gap-1 border-b border-slate-700">
          {(['experience', 'projects', 'posts'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'experience' && (
          <section className="mt-6">
            {isOwnProfile && (
              <form onSubmit={handleAddExperience} className="mb-6 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                {experienceError && (
                  <p className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                    {experienceError}
                  </p>
                )}
                <input name="company" required placeholder="Company" className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <input name="job_title" required placeholder="Job title" className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <input name="location" placeholder="Location" className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <div className="flex flex-wrap gap-2">
                  <input name="start_date" type="date" required className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
                  <input name="end_date" type="date" className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
                  <label className="flex items-center gap-2 text-sm text-slate-400"><input name="is_current" type="checkbox" className="rounded" />Current</label>
                </div>
                <textarea name="description" placeholder="Description" rows={2} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <button type="submit" disabled={addingExperience} className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50">
                  {addingExperience ? 'Adding…' : 'Add experience'}
                </button>
              </form>
            )}
            {work.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-500">No experience yet.</div>
            ) : (
              <ul className="space-y-3">
                {work.map((w) => (
                  <li key={w.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{w.job_title}</p>
                        <p className="text-sm text-slate-400">{w.company}</p>
                        {w.location && <p className="text-xs text-slate-500">{w.location}</p>}
                        <p className="mt-1 text-xs text-slate-500">{w.start_date} – {w.is_current ? 'Present' : w.end_date || '—'}</p>
                        {w.description && <p className="mt-2 text-sm text-slate-300">{w.description}</p>}
                      </div>
                      {isOwnProfile && <button type="button" onClick={() => handleDeleteExperience(w.id)} className="shrink-0 text-slate-500 hover:text-red-400 text-sm">Remove</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'projects' && (
          <section className="mt-6">
            {isOwnProfile && (
              <form onSubmit={handleAddProject} className="mb-6 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                <input name="title" required placeholder="Project title" className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <textarea name="project_description" placeholder="Description" rows={2} className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <input name="url" type="url" placeholder="URL" className="mb-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500" />
                <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500">Add project</button>
              </form>
            )}
            {projects.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-500">No projects yet.</div>
            ) : (
              <ul className="space-y-3">
                {projects.map((p) => (
                  <li key={p.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{p.title}</p>
                        {p.description && <p className="mt-1 text-sm text-slate-400">{p.description}</p>}
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary-400 hover:underline">{p.url}</a>}
                      </div>
                      {isOwnProfile && <button type="button" onClick={() => handleDeleteProject(p.id)} className="shrink-0 text-slate-500 hover:text-red-400 text-sm">Remove</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'posts' && (
          <section className="mt-6">
            {posts.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-500">
                No posts yet.
                {isOwnProfile && <Link to="/feed" className="mt-4 inline-block text-primary-400 hover:underline">Share on Feed</Link>}
              </div>
            ) : (
              <ul className="space-y-4">
                {posts.map((post) => (
                  <li key={post.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                    <p className="text-xs text-slate-500">{new Date(post.created_at).toLocaleString()}</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-200">{post.content}</p>
                    {post.image_url && <img src={post.image_url} alt="" className="mt-3 max-h-72 w-full rounded-lg object-cover" />}
                    {post.video_url && <video src={post.video_url} controls className="mt-3 max-h-72 w-full rounded-lg bg-black" />}
                  </li>
                ))}
                {isOwnProfile && <li><Link to="/feed" className="text-sm text-primary-400 hover:underline">View all on Feed</Link></li>}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
