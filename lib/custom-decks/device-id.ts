/**
 * A random id for this browser, used to tell whose cards are whose. Not a
 * security boundary: it just lives in localStorage.
 */
const KEY = "headbands:device:v1"

let fallback: string | null = null

function newId(): string {
  return crypto.randomUUID().replaceAll("-", "")
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const id = newId()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // Private mode etc.: the id then only lasts for this page load.
    fallback ??= newId()
    return fallback
  }
}
