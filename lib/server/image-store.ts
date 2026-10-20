import type { SupabaseClient } from "@supabase/supabase-js"

export const CARD_IMAGE_BUCKET = "card-images"

export type ImageType = "image/webp" | "image/jpeg" | "image/png" | "image/gif"

const EXTENSIONS: Record<ImageType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
}

/** Identify an image by its magic bytes; the Content-Type header can lie. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end))
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "image/png"
  if (ascii(0, 4) === "GIF8") return "image/gif"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  return null
}

/** Where card images live. Returns public URLs. */
export interface ImageStore {
  put(name: string, bytes: Uint8Array, type: ImageType): Promise<string>
  /** True for URLs this store handed out (cards may only use those). */
  owns(url: string): boolean
}

export function imageFileName(id: string, type: ImageType): string {
  return `${id}.${EXTENSIONS[type]}`
}

/** Local dev without Supabase: images live in memory, served by the app. */
export class MemoryImageStore implements ImageStore {
  static readonly PREFIX = "/api/card-images/"
  private images = new Map<string, { bytes: Uint8Array; type: ImageType }>()

  async put(name: string, bytes: Uint8Array, type: ImageType) {
    this.images.set(name, { bytes, type })
    return MemoryImageStore.PREFIX + name
  }

  get(name: string) {
    return this.images.get(name) ?? null
  }

  owns(url: string) {
    return (
      url.startsWith(MemoryImageStore.PREFIX) &&
      this.images.has(url.slice(MemoryImageStore.PREFIX.length))
    )
  }
}

/** Public Supabase Storage bucket, created by migration 0002. */
export class SupabaseImageStore implements ImageStore {
  private publicPrefix: string

  constructor(private db: SupabaseClient) {
    this.publicPrefix = db.storage
      .from(CARD_IMAGE_BUCKET)
      .getPublicUrl("").data.publicUrl
  }

  async put(name: string, bytes: Uint8Array, type: ImageType) {
    const bucket = this.db.storage.from(CARD_IMAGE_BUCKET)
    const { error } = await bucket.upload(name, bytes, {
      contentType: type,
      cacheControl: "31536000",
      upsert: false,
    })
    if (error) throw new Error(`Supabase image upload failed: ${error.message}`)
    return bucket.getPublicUrl(name).data.publicUrl
  }

  owns(url: string) {
    return url.startsWith(this.publicPrefix)
  }
}
