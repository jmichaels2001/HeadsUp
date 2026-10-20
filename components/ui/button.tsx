import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-ink font-heading font-semibold whitespace-nowrap shadow-pop-sm transition-[transform,box-shadow,background-color] outline-none select-none hover:-translate-y-px focus-visible:ring-4 focus-visible:ring-ring/40 active:translate-x-px active:translate-y-px active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85",
        outline: "bg-card text-ink hover:bg-muted",
        success: "bg-success text-success-foreground hover:bg-success/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost:
          "border-transparent bg-transparent shadow-none hover:translate-y-0 hover:bg-muted",
        link: "border-transparent bg-transparent text-primary underline-offset-4 shadow-none hover:translate-y-0 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        default: "h-11 px-4 text-base",
        lg: "h-12 px-6 text-lg",
        xl: "h-14 px-8 text-xl",
        icon: "size-11",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
