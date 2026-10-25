import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { get, post } from '../lib/api'
import { Alert, Button, Field } from './UI'

export default function ChatWidget({ ponpes }) {
  const available = !!ponpes.konsultasi_tersedia
  const [open, setOpen] = useState(false)
  const [identity, setIdentity] = useState({ nama_warga: '', kontak_warga: '' })
  const [sid, setSid] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const cursor = useRef(0)
  const end = useRef(null)
  useEffect(() => {
    setSid(null)
    setMessages([])
    cursor.current = 0
    setIdentity({ nama_warga: '', kontak_warga: '' })
    setOpen(false)
  }, [ponpes.id])
  useEffect(() => {
    if (!open || !sid) return
    let cancelled = false,
      timer
    async function poll() {
      try {
        const data = await get(`/chat/${ponpes.id}/${sid}`, {
          after_id: cursor.current,
          limit: 100,
        })
        if (!cancelled) {
          setMessages((prev) =>
            [
              ...new Map(
                [...prev, ...data.items].map((message) => [
                  message.id,
                  message,
                ]),
              ).values(),
            ].sort((a, b) => a.id - b.id),
          )
          cursor.current = data.next_after_id
          setError(null)
        }
        if (!cancelled)
          timer = setTimeout(poll, data.items.length === 100 ? 1000 : 12000)
      } catch (e) {
        if (!cancelled) {
          setError(e)
          timer = setTimeout(poll, 20000)
        }
      }
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, sid, ponpes.id])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])
  async function send(e) {
    e.preventDefault()
    if (!available) return
    setBusy(true)
    setError(null)
    try {
      const result = await post('/chat/kirim', {
        ponpes_id: ponpes.id,
        ...identity,
        pesan: text,
        ...(sid ? { session_id: sid } : {}),
      })
      setSid(result.session_id)
      setMessages((prev) => [
        ...new Map([...prev, result].map((m) => [m.id, m])).values(),
      ])
      setText('')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  if (!available && !sid) return null
  return (
    <div className="chat-widget">
      {open ? (
        <section className="chat-panel" aria-label="Konsultasi pengurus">
          <div className="chat-header">
            <MessageCircle size={21} />
            <div>
              <strong>Tanya pengurus</strong>
              <small>{ponpes.nama_ponpes}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Tutup chat"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="chat-messages" aria-live="polite">
            {!messages.length && (
              <div className="chat-intro">
                <MessageCircle size={30} />
                <h3>Mulai percakapan.</h3>
                <p>
                  Tanyakan biaya, kurikulum, atau kunjungan kepada pengurus
                  pesantren.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`bubble ${m.sender_role === 'warga' ? 'bubble-own' : ''}`}
              >
                <small>{m.sender_role === 'warga' ? 'Anda' : 'Pengurus'}</small>
                <p>{m.pesan}</p>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="chat-compose" onSubmit={send}>
            <Alert error={error} />
            {!available && (
              <p className="note" role="status">
                Konsultasi baru sedang ditutup. Riwayat percakapan tetap dapat
                dibaca.
              </p>
            )}
            {!sid && (
              <div className="form-grid">
                <Field label="Nama Anda">
                  <input
                    required
                    maxLength={100}
                    value={identity.nama_warga}
                    onChange={(e) =>
                      setIdentity({ ...identity, nama_warga: e.target.value })
                    }
                  />
                </Field>
                <Field label="Kontak / WhatsApp">
                  <input
                    required
                    type="tel"
                    maxLength={50}
                    value={identity.kontak_warga}
                    onChange={(e) =>
                      setIdentity({ ...identity, kontak_warga: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}
            <div className="chat-send">
              <input
                aria-label="Pesan konsultasi"
                disabled={!available}
                required
                maxLength={4000}
                placeholder="Tulis pesan…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Button
                type="submit"
                busy={busy}
                disabled={!available}
                aria-label="Kirim pesan"
              >
                <Send size={17} />
              </Button>
            </div>
            <small>
              Balasan mengikuti ketersediaan pengurus. Sesi berakhir saat
              halaman dimuat ulang.
            </small>
          </form>
        </section>
      ) : (
        <Button onClick={() => setOpen(true)} className="chat-trigger">
          <MessageCircle size={19} />
          {available ? 'Tanya pengurus' : 'Lihat riwayat konsultasi'}
        </Button>
      )}
    </div>
  )
}
