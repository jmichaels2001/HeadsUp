import { MAX_IMAGE_SIDE } from "./protocol"

const QUALITY = 0.85

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Shrink a pasted or picked image so its longest side is at most
 * MAX_IMAGE_SIDE, re-encoded as WebP (or JPEG where WebP encoding isn't
 * supported, e.g. older Safari). Browser only.
 */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(
    1,
    MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height),
  )
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas isn't available.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const webp = await toBlob(canvas, "image/webp")
  if (webp?.type === "image/webp") return webp

  // JPEG has no transparency: put the image on white first.
  ctx.globalCompositeOperation = "destination-over"
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const jpeg = await toBlob(canvas, "image/jpeg")
  if (!jpeg) throw new Error("Couldn't encode the image.")
  return jpeg
}

/** The first image on the clipboard, if any. */
export function imageFromClipboard(data: DataTransfer | null): File | null {
  for (const item of data?.items ?? []) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile()
    }
  }
  return null
}
