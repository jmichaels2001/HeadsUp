import { librarySortSchema } from "@/lib/custom-decks/protocol"
import { getDeckService } from "@/lib/server"
import { handle } from "@/lib/server/http"

/** Playable, unhidden decks. Names and counts only, never cards. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const sort = librarySortSchema.catch("newest").parse(params.get("sort"))
  return handle(() => getDeckService().listLibrary(params.get("q") ?? "", sort))
}
