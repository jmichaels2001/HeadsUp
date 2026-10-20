import "server-only"

import { cookies } from "next/headers"

import { ADMIN_COOKIE, isAdminToken } from "./admin-service"
import { RoomError } from "./room-service"

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_SECRET
}

/** Whether this request carries a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  return isAdminToken(process.env.ADMIN_SECRET, token)
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new RoomError("unauthorized", "Sign in as admin first.")
  }
}
