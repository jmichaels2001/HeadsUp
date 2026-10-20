import { getRoomService } from "@/lib/server"
import {
  bearerToken,
  handle,
  normalizeCode,
  parseBody,
} from "@/lib/server/http"
import { clientActionSchema } from "@/lib/room/protocol"

/** Apply one game action as the token's player. */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/rooms/[code]/actions">,
) {
  const { code } = await ctx.params
  return handle(async () =>
    getRoomService().act(
      normalizeCode(code),
      bearerToken(req),
      await parseBody(req, clientActionSchema),
    ),
  )
}
