import { reportSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { deviceId, handle, parseBody } from "@/lib/server/http"

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/decks/[id]/report">,
) {
  const { id } = await ctx.params
  return handle(async () =>
    getDeckService().report(
      id,
      deviceId(req),
      await parseBody(req, reportSchema),
    ),
  )
}
