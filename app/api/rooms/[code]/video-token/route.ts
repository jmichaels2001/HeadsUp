import { getRoomService } from "@/lib/server"
import { bearerToken, handle, normalizeCode } from "@/lib/server/http"

/** A LiveKit token for the requesting player's video call. */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/rooms/[code]/video-token">,
) {
  const { code } = await ctx.params
  return handle(() =>
    getRoomService().videoToken(normalizeCode(code), bearerToken(req)),
  )
}
