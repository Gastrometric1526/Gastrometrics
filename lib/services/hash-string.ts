/** Hash estable (no criptográfico) para elegir variantes de correo por cuenta y tipo. */
export function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}
