// Mark for the report aside: incognito hat + glasses for secret mode,
// ID badge for open mode. Same stroke weight so both read as one family.
export default function ModeMark({ secret }) {
  return (
    <div className={`mode-mark ${secret ? 'is-secret' : 'is-open'}`}>
      <span className="mode-mark-badge">
        <svg
          className="mode-mark-art"
          viewBox="0 0 64 64"
          role="img"
          aria-label={
            secret
              ? 'Kartu identitas kosong: nama tidak dicatat'
              : 'Kartu identitas terisi: nama dan kontak dicatat'
          }
        >
          <rect x="9" y="14" width="46" height="34" rx="4.5" />
          {secret ? (
            <>
              <circle cx="23" cy="27" r="5" strokeDasharray="3.2 3.4" />
              <path
                d="M15.5 40c0-4.2 3.4-6.6 7.5-6.6s7.5 2.4 7.5 6.6"
                strokeDasharray="3.2 3.4"
              />
              <path d="M38 28h10M38 35h10" strokeDasharray="3.2 3.4" />
            </>
          ) : (
            <>
              <circle cx="23" cy="27" r="5" />
              <path d="M15.5 40c0-4.2 3.4-6.6 7.5-6.6s7.5 2.4 7.5 6.6" />
              <path d="M36 26h12M36 32h12M36 38h7" />
            </>
          )}
        </svg>
      </span>
      <span className="mode-mark-caption">
        <span className="live-dot" aria-hidden="true" />
        {secret ? 'Mode rahasia aktif' : 'Mode terbuka aktif'}
      </span>
    </div>
  )
}
