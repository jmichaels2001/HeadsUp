import { addCardSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { deviceId, handle, parseBody } from "@/lib/server/http"

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/decks/[id]/cards">,
) {
  const { id } = await ctx.params
  return handle(async () =>
    getDeckService().addCard(
      id,
      deviceId(req),
      await parseBody(req, addCardSchema),
    ),
  )
}
