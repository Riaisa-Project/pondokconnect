import { createContext, useContext, useEffect, useState } from 'react'
import { parseSaved, toggleSlug } from './discovery'
const Context = createContext(null)
function read(key, limit) {
  try {
    return parseSaved(localStorage.getItem(key), limit)
  } catch {
    return []
  }
}
export function DiscoveryProvider({ children }) {
  const [saved, setSaved] = useState(() => read('pondok.saved.v1', 100))
  const [compare, setCompare] = useState(() => read('pondok.compare.v1', 3))
  const [notice, setNotice] = useState('')
  useEffect(() => {
    try {
      localStorage.setItem('pondok.saved.v1', JSON.stringify(saved))
      localStorage.setItem('pondok.compare.v1', JSON.stringify(compare))
    } catch {
      /* Discovery stays usable when storage is blocked. */
    }
  }, [saved, compare])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timer)
  }, [notice])
  function toggleCompare(slug) {
    setCompare((prev) => {
      const result = toggleSlug(prev, slug, 3)
      if (result.full)
        queueMicrotask(() =>
          setNotice(
            'Pilih maksimal 3 pesantren. Hapus satu pilihan untuk menambahkan yang lain.',
          ),
        )
      return result.items
    })
  }
  return (
    <Context.Provider
      value={{
        saved,
        compare,
        toggleSave: (slug) => setSaved((prev) => toggleSlug(prev, slug).items),
        toggleCompare,
        clearCompare: () => setCompare([]),
        notice,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export const useDiscovery = () => useContext(Context)
