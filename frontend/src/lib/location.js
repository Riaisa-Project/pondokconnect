export function directionsUrl(ponpes) {
  if (!ponpes.lokasi?.alamat_bersumber) return null
  const destination = `${ponpes.nama_ponpes}, ${ponpes.alamat_lengkap}`
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`
}
export function hasMapPoint(ponpes) {
  return (
    Boolean(ponpes.lokasi?.pin_tersedia) &&
    Number.isFinite(ponpes.latitude) &&
    Number.isFinite(ponpes.longitude) &&
    Math.abs(ponpes.latitude) <= 90 &&
    Math.abs(ponpes.longitude) <= 180
  )
}
