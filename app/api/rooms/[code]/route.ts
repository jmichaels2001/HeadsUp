import { getRoomService } from "@/lib/server"
import { bearerToken, handle, normalizeCode } from "@/lib/server/http"

/** The requesting player's view of the room. */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/rooms/[code]">,
) {
  const { code } = await ctx.params
  return handle(() =>
    getRoomService().getRoom(normalizeCode(code), bearerToken(req)),
  )
}
