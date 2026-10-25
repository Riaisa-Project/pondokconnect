import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../lib/api'
import { hasRegistrationSeats } from '../lib/services'
import { Alert, Button, Field } from './UI'

export function usePonpesOptions({ serviceOnly = true } = {}) {
  return useQuery({
    queryKey: ['ponpes-options', serviceOnly],
    queryFn: async () => {
      let items = [],
        offset = 0
      while (true) {
        const page = await get('/ponpes/', {
          limit: 100,
          offset,
          layanan: serviceOnly ? 'aktif' : undefined,
        })
        items = items.concat(page.items)
        if (!page.items.length || items.length >= page.total)
          return serviceOnly ? items.filter(hasRegistrationSeats) : items
        offset += 100
      }
    },
  })
}
export default function PonpesSelect({
  value,
  onChange,
  allowInactive = false,
}) {
  const query = usePonpesOptions({ serviceOnly: !allowInactive })
  const [extra, setExtra] = useState(null)
  const [nspp, setNspp] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function lookup() {
    setBusy(true)
    setError(null)
    try {
      if (!/^[0-9]{12}$/.test(nspp)) throw new Error('Masukkan NSPP 12 digit.')
      const item = await get(`/ponpes/verifikasi-ijop/${nspp}`)
      setExtra(item)
      onChange(String(item.id))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const items = [
    ...new Map(
      [...(query.data || []), ...(extra ? [extra] : [])].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ]
  return (
    <div className="stack-small">
      <Field label="Pilih pesantren">
        <select
          name="ponpes_id"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={query.isPending}
        >
          <option value="">
            {query.isPending ? 'Memuat pesantren…' : 'Pilih pesantren tujuan'}
          </option>
          {items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama_ponpes}
            </option>
          ))}
        </select>
      </Field>
      {query.error && (
        <>
          <Alert error={query.error} />
          <Button variant="secondary" onClick={() => query.refetch()}>
            Muat ulang pesantren
          </Button>
        </>
      )}
      {allowInactive && (
        <details className="lookup-details">
          <summary>Pesantren tidak ada di daftar?</summary>
          <p>
            Periksa menggunakan nomor statistik, termasuk profil dengan layanan
            portal tertutup.
          </p>
          <div className="input-action">
            <input
              aria-label="NSPP pesantren"
              placeholder="NSPP 12 digit"
              inputMode="numeric"
              maxLength={12}
              value={nspp}
              onChange={(e) => setNspp(e.target.value)}
            />
            <Button variant="secondary" busy={busy} onClick={lookup}>
              Cari NSPP
            </Button>
          </div>
          <Alert error={error} />
        </details>
      )}
    </div>
  )
}
