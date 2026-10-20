import { cookies } from "next/headers"
import { z } from "zod"

import { RoomError } from "@/lib/server"
import {
  ADMIN_COOKIE,
  adminToken,
  isAdminSecret,
} from "@/lib/server/admin-service"
import { handle, parseBody } from "@/lib/server/http"

const signInSchema = z.strictObject({ secret: z.string().max(200) })

/** Sign in: checks ADMIN_SECRET and sets an httpOnly cookie (a hash of it). */
export async function POST(req: Request) {
  return handle(async () => {
    const secret = process.env.ADMIN_SECRET
    if (!secret) {
      throw new RoomError("unavailable", "Admin isn't configured.")
    }
    const { secret: attempt } = await parseBody(req, signInSchema)
    if (!isAdminSecret(secret, attempt)) {
      throw new RoomError("unauthorized", "That's not the admin secret.")
    }
    ;(await cookies()).set(ADMIN_COOKIE, adminToken(secret), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
    return { ok: true }
  })
}

export async function DELETE() {
  return handle(async () => {
    ;(await cookies()).delete(ADMIN_COOKIE)
    return { ok: true }
  })
}
