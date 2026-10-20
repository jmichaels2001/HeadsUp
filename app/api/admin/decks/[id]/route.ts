import { z } from "zod"

import { getAdminService } from "@/lib/server"
import { requireAdmin } from "@/lib/server/admin-auth"
import { handle, parseBody } from "@/lib/server/http"

const actionSchema = z.strictObject({
  action: z.enum(["dismiss", "hide", "unhide", "delete"]),
})

/** Moderate a deck: dismiss its reports, hide, unhide, or delete it. */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/admin/decks/[id]">,
) {
  const { id } = await ctx.params
  return handle(async () => {
    await requireAdmin()
    const { action } = await parseBody(req, actionSchema)
    return getAdminService().act(id, action)
  })
}
