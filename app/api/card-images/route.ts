import { MAX_IMAGE_BYTES } from "@/lib/custom-decks/protocol"
import { getDeckService, RoomError } from "@/lib/server"
import { handle } from "@/lib/server/http"

/** Upload a card image as the raw request body. Returns its public URL. */
export async function POST(req: Request) {
  return handle(async () => {
    const length = Number(req.headers.get("content-length") ?? 0)
    if (length > MAX_IMAGE_BYTES) {
      throw new RoomError("invalid", "That image is too big (1 MB max).")
    }
    const bytes = new Uint8Array(await req.arrayBuffer())
    return getDeckService().uploadImage(bytes)
  })
}
