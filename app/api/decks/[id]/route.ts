import { updateDeckSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { deviceId, handle, parseBody } from "@/lib/server/http"

/** The deck as this device sees it: only its own cards, plus a count. */
export async function GET(req: Request, ctx: RouteContext<"/api/decks/[id]">) {
  const { id } = await ctx.params
  return handle(() => getDeckService().getDeck(id, deviceId(req)))
}

/** Name, emoji, and description; rejected if someone else saved first. */
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/decks/[id]">,
) {
  const { id } = await ctx.params
  return handle(async () =>
    getDeckService().updateDeck(
      id,
      deviceId(req),
      await parseBody(req, updateDeckSchema),
    ),
  )
}

export async function DELETE(
  req: Request,
  ctx: RouteContext<"/api/decks/[id]">,
) {
  const { id } = await ctx.params
  return handle(async () => {
    await getDeckService().deleteDeck(id, deviceId(req))
    return { ok: true }
  })
}
