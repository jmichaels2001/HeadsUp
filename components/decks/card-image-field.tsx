"use client"

import { cn } from "cn"
import { ImagePlus, LoaderCircle, X } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"

/** Thumbnail plus "Add image" / Replace / Remove for one card. */
export function CardImageField({
  imageUrl,
  uploading,
  label,
  onPick,
  onRemove,
  className,
}: {
  imageUrl: string | null
  uploading: boolean
  /** Card label, for accessible button names. */
  label: string
  onPick: (file: File) => void
  onRemove: () => void
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const name = label.trim() || "this card"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-ink bg-muted">
        {uploading ? (
          <LoaderCircle
            aria-label="Uploading image"
            className="size-5 animate-spin text-muted-foreground"
          />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- already resized on upload
          <img src={imageUrl} alt="" className="size-full object-contain" />
        ) : (
          <ImagePlus aria-hidden className="size-5 text-muted-foreground" />
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => input.current?.click()}
        aria-label={`${imageUrl ? "Replace" : "Add"} image for ${name}`}
      >
        {imageUrl ? "Replace" : "Add image"}
      </Button>
      {imageUrl && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={uploading}
          onClick={onRemove}
          aria-label={`Remove image from ${name}`}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
