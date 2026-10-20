import { deckMetaSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { deviceId, handle, parseBody } from "@/lib/server/http"

/** Decks this device created or added cards to. */
export async function GET(req: Request) {
  return handle(() => getDeckService().listMyDecks(deviceId(req)))
}

export async function POST(req: Request) {
  return handle(async () =>
    getDeckService().createDeck(
      deviceId(req),
      await parseBody(req, deckMetaSchema),
    ),
  )
}
