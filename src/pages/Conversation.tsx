import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type ConversationRow = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  listings?: { title: string } | null
  buyer?: { display_name: string | null } | null
  seller?: { display_name: string | null } | null
}

type MessageRow = {
  id: string
  sender_id: string
  body: string
  created_at: string
}

export default function Conversation() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState<ConversationRow | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!conversationId || !user?.id) return
    setLoading(true)
    setError('')
    supabase
      .from('conversations')
      .select(
        'id, listing_id, buyer_id, seller_id, listings(title), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:profiles!conversations_seller_id_fkey(display_name)'
      )
      .eq('id', conversationId)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        setConversation(((data ?? null) as unknown) as ConversationRow | null)
        setLoading(false)
      })
  }, [conversationId, user?.id])

  useEffect(() => {
    if (!conversationId || !user?.id) return
    supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        setMessages((data as MessageRow[]) ?? [])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
      })
  }, [conversationId, user?.id])

  const otherName = useMemo(() => {
    if (!conversation || !user?.id) return 'User'
    const isBuyer = conversation.buyer_id === user.id
    return isBuyer
      ? conversation.seller?.display_name || 'Seller'
      : conversation.buyer?.display_name || 'Buyer'
  }, [conversation, user?.id])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !conversationId) return
    const text = body.trim()
    if (!text) return
    setBody('')
    const { data, error: err } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
      .select('id, sender_id, body, created_at')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    if (data) {
      setMessages((prev) => [...prev, data as MessageRow])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-400">
        Loading…
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-400">
        Conversation not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">
            <Link to="/messages" className="hover:underline">
              Messages
            </Link>{' '}
            / {conversation.listings?.title ?? 'Listing'}
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold text-white">
            Chat with {otherName}
          </h1>
        </div>
        <Link
          to={`/listing/${conversation.listing_id}`}
          className="text-sm text-primary-400 hover:underline"
        >
          View listing
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/30">
        <div className="max-h-[55vh] overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-slate-500">No messages yet.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const mine = m.sender_id === user?.id
                return (
                  <div
                    key={m.id}
                    className={mine ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={
                        mine
                          ? 'max-w-[80%] rounded-2xl bg-primary-600 px-4 py-2 text-white'
                          : 'max-w-[80%] rounded-2xl bg-slate-800 px-4 py-2 text-slate-100'
                      }
                    >
                      <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      <p className="mt-1 text-[10px] text-white/70">
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <form onSubmit={handleSend} className="border-t border-slate-800 p-3">
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

