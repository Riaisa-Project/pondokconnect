import { Bookmark, Check, GitCompareArrows, X, ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useDiscovery } from '../lib/discovery.jsx'
export function DiscoveryActions({ ponpes, compact = false }) {
  const { saved, compare, toggleSave, toggleCompare } = useDiscovery()
  const isSaved = saved.includes(ponpes.slug),
    isCompared = compare.includes(ponpes.slug)
  return (
    <div className={`discovery-actions ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className={isSaved ? 'selected' : ''}
        aria-pressed={isSaved}
        onClick={() => toggleSave(ponpes.slug)}
        aria-label={`${isSaved ? 'Hapus simpanan' : 'Simpan'} ${ponpes.nama_ponpes}`}
      >
        <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
        {!compact && (isSaved ? 'Tersimpan' : 'Simpan')}
      </button>
      <button
        type="button"
        className={isCompared ? 'selected' : ''}
        aria-pressed={isCompared}
        onClick={() => toggleCompare(ponpes.slug)}
        aria-label={`${isCompared ? 'Hapus perbandingan' : 'Bandingkan'} ${ponpes.nama_ponpes}`}
      >
        {isCompared ? <Check size={16} /> : <GitCompareArrows size={16} />}
        Bandingkan
      </button>
    </div>
  )
}
export function CompareTray() {
  const { compare, clearCompare, notice } = useDiscovery()
  const location = useLocation()
  return (
    <>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {compare.length > 0 &&
        !['/bandingkan', '/admin', '/masuk', '/ganti-password'].includes(
          location.pathname,
        ) && (
          <aside className="compare-tray" aria-label="Pilihan perbandingan">
            <div className="tray-icon">
              <GitCompareArrows size={20} />
            </div>
            <div>
              <strong>{compare.length} pesantren dipilih</strong>
              <small>Bandingkan profil, program, dan kuota</small>
            </div>
            <Link
              className="button button-primary"
              to={`/bandingkan?pilihan=${compare.join(',')}`}
            >
              Lihat perbandingan <ArrowRight size={16} />
            </Link>
            <button
              className="icon-button"
              onClick={clearCompare}
              aria-label="Kosongkan perbandingan"
            >
              <X size={18} />
            </button>
          </aside>
        )}
    </>
  )
}
