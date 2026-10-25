import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from './api'

export function useApi(path, params, options = {}) {
  return useQuery({
    queryKey: [path, params || null],
    queryFn: () => get(path, params),
    enabled: Boolean(path),
    ...options,
  })
}
export function useFeatures() {
  return useApi('/system/features', null, { staleTime: 60000 })
}
export function useDebounce(value, delay = 350) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const listener = () => setReduced(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return reduced
}
