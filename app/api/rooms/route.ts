import { getRoomService } from "@/lib/server"
import { handle, parseBody } from "@/lib/server/http"
import { joinRequestSchema } from "@/lib/room/protocol"

/** Create a room; the creator becomes host. */
export async function POST(req: Request) {
  return handle(async () =>
    getRoomService().createRoom(await parseBody(req, joinRequestSchema)),
  )
}
