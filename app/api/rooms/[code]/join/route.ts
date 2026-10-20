import { getRoomService } from "@/lib/server"
import { handle, normalizeCode, parseBody } from "@/lib/server/http"
import { joinRequestSchema } from "@/lib/room/protocol"

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/rooms/[code]/join">,
) {
  const { code } = await ctx.params
  return handle(async () =>
    getRoomService().joinRoom(
      normalizeCode(code),
      await parseBody(req, joinRequestSchema),
    ),
  )
}
