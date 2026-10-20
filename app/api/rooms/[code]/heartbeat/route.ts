import { getRoomService } from "@/lib/server"
import { bearerToken, handle, normalizeCode } from "@/lib/server/http"

/** Keep this seat alive; also removes players who've gone silent. */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/rooms/[code]/heartbeat">,
) {
  const { code } = await ctx.params
  return handle(async () => {
    await getRoomService().heartbeat(normalizeCode(code), bearerToken(req))
    return { ok: true }
  })
}
