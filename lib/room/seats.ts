import type { Seat } from "./protocol"

/**
 * This browser's seats (player id + token) per room, so a refresh puts you
 * back in your room. localStorage, so it survives closing the tab.
 */
const KEY = "headbands:seats:v1"

export function loadSeats(): Record<string, Seat> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Seat>
  } catch {
    return {}
  }
}

export function saveSeats(seats: Record<string, Seat>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(seats))
  } catch {
    // Private mode etc.: seats then only last for this page load.
  }
}
