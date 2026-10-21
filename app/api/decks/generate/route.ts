import { generateDeckSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { deviceId, handle, parseBody } from "@/lib/server/http"

/** Whether AI generation is configured (ANTHROPIC_API_KEY is set). */
export async function GET() {
  return handle(async () => ({ enabled: getDeckService().aiEnabled }))
}

/** Generate a blind deck from a prompt and save it. */
export async function POST(req: Request) {
  return handle(async () =>
    getDeckService().generate(
      deviceId(req),
      await parseBody(req, generateDeckSchema),
    ),
  )
}
