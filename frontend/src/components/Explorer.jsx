import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Map,
  Building2,
  RotateCcw,
  Pause,
  Play,
  Move,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Map3D } from './Scene'
import { CAMPUS_TARGETS, DISTRICT_POINTS } from '../three/cameraModel'
const campusInfo = {
  masjid: [
    'Masjid & ruang ibadah',
    'Pusat kegiatan ibadah dan pembelajaran agama.',
  ],
  belajar: [
    'Ruang belajar',
    'Ruang untuk mendalami ilmu, berdiskusi, dan tumbuh bersama.',
  ],
  asrama: [
    'Kehidupan berasrama',
    'Ilustrasi lingkungan tinggal dan kebersamaan santri.',
  ],
}
export default function Explorer({ districts = [] }) {
  const [mode, setMode] = useState('campus'),
    [paused, setPaused] = useState(false),
    [selected, setSelected] = useState(null),
    [campus, setCampus] = useState(null),
    [renderer, setRenderer] = useState('loading'),
    [expanded, setExpanded] = useState(false),
    [command, setCommand] = useState({ kind: 'overview', seq: 0 })
  const [hoveredDistrict, setHoveredDistrict] = useState(null)
  const stage = useRef(null),
    expandButton = useRef(null),
    closeButton = useRef(null)
  const district = districts.find((d) => d.kecamatan_id === selected)
  const renderState = useCallback((value) => setRenderer(value), []),
    manual = useCallback(() => setPaused(true), [])
  function action(kind, target) {
    setPaused(true)
    setCommand((prev) => ({ kind, target, seq: prev.seq + 1 }))
  }
  function chooseDistrict(id, target) {
    setSelected(id)
    if (!id) action('overview')
    if (target) action('focus', target)
  }
  function chooseCampus(key, target) {
    setCampus(key)
    action('focus', target || CAMPUS_TARGETS[key])
  }
  function switchMode(next) {
    setMode(next)
    action('overview')
  }
  useEffect(() => {
    if (!expanded) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const keydown = (e) => {
      if (e.key === 'Escape') {
        setExpanded(false)
        return
      }
      if (e.key === 'Tab') {
        const elements = [
          ...stage.current.querySelectorAll(
            'button:not(:disabled),a[href],select:not(:disabled)',
          ),
        ].filter(
          (el) =>
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== 'hidden',
        )
        if (!elements.length) return
        const first = elements[0],
          last = elements.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', keydown)
      expandButton.current?.focus()
    }
  }, [expanded])
  const ready = renderer === 'webgl' || renderer === 'svg'
  return (
    <div
      ref={stage}
      className={`explorer-stage ${expanded ? 'explorer-expanded' : ''}`}
      data-renderer={renderer}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? 'true' : undefined}
      aria-label={expanded ? 'Jelajah 3D pesantren' : undefined}
    >
      <div className="explorer-top">
        <span>
          <span className="live-dot" /> JELAJAH LINGKUNGAN PESANTREN
        </span>
        <span className={`explorer-tech renderer-${renderer}`}>
          {renderer === 'webgl'
            ? '3D AKTIF'
            : renderer === 'svg'
              ? '3D COMPATIBLE'
              : 'MENYIAPKAN 3D'}
        </span>
      </div>
      <div
        className="explorer-tabs"
        role="group"
        aria-label="Mode eksplorasi 3D"
      >
        <button
          aria-pressed={mode === 'campus'}
          className={mode === 'campus' ? 'active' : ''}
          onClick={() => switchMode('campus')}
        >
          <Building2 size={15} />
          Kampus pesantren
        </button>
        <button
          aria-pressed={mode === 'region'}
          className={mode === 'region' ? 'active' : ''}
          onClick={() => switchMode('region')}
        >
          <Map size={15} />
          Peta Lamongan
        </button>
      </div>
      <Map3D
        districts={districts}
        selected={selected}
        onChoose={chooseDistrict}
        mode={mode}
        paused={paused}
        command={command}
        stageRef={stage}
        onManualChange={manual}
        onRenderState={renderState}
        onDistrictHover={setHoveredDistrict}
        campusSelected={campus}
        onCampusSelect={chooseCampus}
      />
      {ready && (
        <div className="scene-world-labels">
          {mode === 'campus'
            ? [
                ['masjid', 'Masjid', [0, 2.13, -0.55]],
                ['belajar', 'Ruang belajar', [-2.2, 1.25, -0.5]],
                ['asrama', 'Asrama', [2.15, 1.25, 1.55]],
              ].map(([key, text, point]) => (
                <div
                  key={key}
                  className="scene-world-anchor"
                  data-world-point={point.join(',')}
                  style={{ visibility: 'hidden' }}
                >
                  <button
                    className={`world-hotspot ${campus === key ? 'active' : ''}`}
                    aria-label={`Fokus ke ${key === 'belajar' ? 'ruang belajar' : key}`}
                    aria-pressed={campus === key}
                    onPointerEnter={() => setPaused(true)}
                    onFocus={() => setPaused(true)}
                    onClick={() => chooseCampus(key)}
                  >
                    <span className="hotspot-dot" />
                    {text}
                    <span className="hotspot-arrow">↗</span>
                  </button>
                </div>
              ))
            : (() => {
                const id = hoveredDistrict || selected,
                  index = districts.findIndex((d) => d.kecamatan_id === id)
                if (index < 0) return null
                const [x, z] = DISTRICT_POINTS[index % 27],
                  d = districts[index]
                return (
                  <div
                    className="scene-world-anchor"
                    data-world-point={[x * 1.35, 1.03, -z * 1.35].join(',')}
                    style={{ visibility: 'hidden' }}
                  >
                    <div className="world-tooltip">
                      <strong>{d.nama_kecamatan}</strong>
                      <span>{d.jumlah_ponpes} profil pesantren</span>
                      <small>Klik pin untuk mendekat</small>
                    </div>
                  </div>
                )
              })()}
        </div>
      )}
      <div className="explorer-controls">
        <button
          ref={expanded ? closeButton : expandButton}
          aria-label={expanded ? 'Tutup layar penuh 3D' : 'Buka layar penuh 3D'}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
        <button
          aria-label="Putar kiri 3D"
          disabled={!ready}
          onClick={() => action('left')}
        >
          <RotateCcw size={17} />
        </button>
        <button
          aria-label="Putar kanan 3D"
          disabled={!ready}
          onClick={() => action('right')}
        >
          <RotateCw size={17} />
        </button>
        <button
          aria-label="Perbesar 3D"
          disabled={!ready}
          onClick={() => action('in')}
        >
          <ZoomIn size={17} />
        </button>
        <button
          aria-label="Perkecil 3D"
          disabled={!ready}
          onClick={() => action('out')}
        >
          <ZoomOut size={17} />
        </button>
        <button
          aria-label={paused ? 'Jalankan animasi 3D' : 'Jeda animasi 3D'}
          disabled={!ready}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
        <button
          aria-label="Reset tampilan 3D"
          disabled={!ready}
          onClick={() => action('overview')}
        >
          <Move size={17} />
        </button>
      </div>
      {ready && (
        <div className="explorer-instruction">
          <Move size={13} />
          {mode === 'campus'
            ? 'Klik bangunan untuk mendekat · geser untuk memutar'
            : 'Hover pin untuk info · klik untuk mendekat'}
        </div>
      )}
      {mode === 'campus' && (
        <div
          className="explorer-campus-options"
          role="group"
          aria-label="Bagian kampus ilustratif"
        >
          {Object.entries(campusInfo).map(([key]) => (
            <button
              key={key}
              aria-pressed={campus === key}
              onClick={() => chooseCampus(key)}
            >
              {key === 'masjid'
                ? 'Masjid'
                : key === 'belajar'
                  ? 'Ruang belajar'
                  : 'Asrama'}
            </button>
          ))}
        </div>
      )}
      <div className="explorer-info">
        <div>
          <small>
            {mode === 'region'
              ? district
                ? 'KECAMATAN PILIHAN'
                : '27 KECAMATAN · SATU KONEKSI'
              : 'JELAJAH KAMPUS KONSEPTUAL'}
          </small>
          <strong>
            {mode === 'region'
              ? district
                ? district.nama_kecamatan
                : 'Temukan pesantren di sekitar Anda.'
              : campus
                ? campusInfo[campus][0]
                : 'Masjid, ruang belajar, dan kehidupan santri.'}
          </strong>
          <p>
            {mode === 'region'
              ? district
                ? `${district.jumlah_ponpes} profil pesantren dalam portal`
                : 'Klik pin bercahaya untuk melihat lebih dekat.'
              : campus
                ? campusInfo[campus][1]
                : 'Klik bangunan atau label di dalam scene untuk menjelajah.'}
          </p>
        </div>
        {mode === 'region' && district ? (
          <Link
            to={`/pesantren?kecamatan_id=${district.kecamatan_id}`}
            aria-label={`Jelajahi pesantren ${district.nama_kecamatan}`}
          >
            <ArrowUpRight size={23} />
          </Link>
        ) : (
          <Building2 size={25} />
        )}
      </div>
      <div className="explorer-bottom">
        <span>
          {mode === 'region'
            ? 'Peta stilasi · posisi pin ilustratif'
            : 'Diorama arsitektur · bukan kampus sebenarnya'}
        </span>
        {mode === 'region' && (
          <select
            aria-label="Jelajahi kecamatan"
            value={selected || ''}
            onChange={(e) => {
              const id = Number(e.target.value) || null
              const index = districts.findIndex((d) => d.kecamatan_id === id)
              chooseDistrict(
                id,
                index >= 0
                  ? [
                      DISTRICT_POINTS[index % 27][0] * 1.35,
                      0.27,
                      -DISTRICT_POINTS[index % 27][1] * 1.35,
                    ]
                  : null,
              )
            }}
          >
            <option value="">Pilih kecamatan ↗</option>
            {districts.map((d) => (
              <option key={d.kecamatan_id} value={d.kecamatan_id}>
                {d.nama_kecamatan}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
