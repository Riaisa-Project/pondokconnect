export function hasRegistrationSeats(ponpes) {
  return (
    !!ponpes.pendaftaran_tersedia &&
    ((ponpes.sisa_kuota_putra ?? 0) > 0 || (ponpes.sisa_kuota_putri ?? 0) > 0)
  )
}
