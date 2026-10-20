import "server-only"

import { NextResponse } from "next/server"
import type { z } from "zod"

import type { ApiError } from "@/lib/room/protocol"

import { RoomError } from "./room-service"

/** Turn thrown RoomErrors (and anything else) into JSON error responses. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn())
  } catch (err) {
    if (err instanceof RoomError) {
      return NextResponse.json<ApiError>(
        { error: err.code, message: err.message },
        { status: err.status },
      )
    }
    console.error(err)
    return NextResponse.json<ApiError>(
      { error: "unavailable", message: "Something went wrong on our side." },
      { status: 500 },
    )
  }
}

export function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? ""
  return header.startsWith("Bearer ") ? header.slice(7).trim() : ""
}

export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  const body = await req.json().catch(() => undefined)
  const result = schema.safeParse(body)
  if (!result.success) throw new RoomError("invalid", "Invalid request.")
  return result.data
}

export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
}
