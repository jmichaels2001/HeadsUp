import { getMemoryImageStore } from "@/lib/server"

/** Local dev without Supabase: serve images kept in memory. */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/card-images/[name]">,
) {
  const { name } = await ctx.params
  const image = getMemoryImageStore()?.get(name)
  if (!image) return new Response("Not found", { status: 404 })
  return new Response(new Blob([image.bytes as Uint8Array<ArrayBuffer>]), {
    headers: {
      "content-type": image.type,
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
