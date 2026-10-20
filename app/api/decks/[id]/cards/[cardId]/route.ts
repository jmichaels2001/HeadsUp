import { updateCardSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { deviceId, handle, parseBody } from "@/lib/server/http"

/** Only the card's creator can edit or remove it. */
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/decks/[id]/cards/[cardId]">,
) {
  const { id, cardId } = await ctx.params
  return handle(async () =>
    getDeckService().updateCard(
      id,
      cardId,
      deviceId(req),
      await parseBody(req, updateCardSchema),
    ),
  )
}

export async function DELETE(
  req: Request,
  ctx: RouteContext<"/api/decks/[id]/cards/[cardId]">,
) {
  const { id, cardId } = await ctx.params
  return handle(() => getDeckService().removeCard(id, cardId, deviceId(req)))
}
