import { cloneElement, useEffect, useId, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  LoaderCircle,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { label } from '../lib/format'

export function Button({
  children,
  busy,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      className={`button button-${variant} ${className}`}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  )
}
export const LinkButton = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => (
  <Link {...props} className={`button button-${variant} ${className}`}>
    {children}
  </Link>
)
export function Field({ label: text, hint, children, className = '' }) {
  const generatedId = useId()
  const id = children.props.id || generatedId
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{text}</label>
      {cloneElement(children, {
        id,
        'aria-describedby': hint
          ? `${id}-hint`
          : children.props['aria-describedby'],
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  )
}
export function SelectOptions({ values }) {
  return Object.entries(values).map(([key, text]) => (
    <option key={key} value={key}>
      {text}
    </option>
  ))
}
export function Alert({ error, children, success = false }) {
  if (!error && !children) return null
  const Icon = success ? CheckCircle2 : AlertCircle
  return (
    <div
      className={`alert ${success ? 'alert-success' : ''}`}
      role={success ? 'status' : 'alert'}
    >
      <Icon size={19} />
      <div>{children || errorMessage(error)}</div>
    </div>
  )
}
export function Loading({ text = 'Memuat data…' }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {text}
    </div>
  )
}
export function Empty({ title = 'Belum ada data', children }) {
  return (
    <div className="empty">
      <div className="empty-mark">—</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
export function QueryState({ query, children }) {
  if (query.isPending) return <Loading />
  if (query.isError)
    return (
      <div className="stack">
        <Alert error={query.error} />
        <Button variant="secondary" onClick={() => query.refetch()}>
          Coba lagi
        </Button>
      </div>
    )
  return children(query.data)
}
export function Badge({ value, children }) {
  const tone = ['aktif', 'diterima', 'selesai', 'lolos_berkas'].includes(value)
    ? 'green'
    : ['ditolak', 'kedaluwarsa', 'tidak_valid'].includes(value)
      ? 'red'
      : 'gold'
  return (
    <span className={`badge badge-${tone}`}>
      <span />
      {children || label(value)}
    </span>
  )
}
export function PageHeading({ eyebrow, title, children, back }) {
  return (
    <div className="page-heading">
      {back && (
        <Link className="back-link" to={back}>
          <ArrowLeft size={15} />
          Kembali
        </Link>
      )}
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  )
}
export function Pagination({ total, offset, limit, onChange }) {
  if (total <= limit) return null
  return (
    <div className="pagination">
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} dari {total}
      </span>
      <div>
        <Button
          variant="secondary"
          aria-label="Halaman sebelumnya"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ArrowLeft size={16} />
        </Button>
        <Button
          variant="secondary"
          aria-label="Halaman berikutnya"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
export function CopyCode({
  value,
  caption = 'Simpan kode ini untuk melacak status.',
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setError('Salin kode secara manual dengan memilih teks di atas.')
    }
  }
  return (
    <div className="copy-block">
      <small>{caption}</small>
      <div>
        <code>{value}</code>
        <Button variant="secondary" onClick={copy} aria-label="Salin kode">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>
      {error && <small>{error}</small>}
    </div>
  )
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Tutup jendela"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  )
}
