/**
 * Dev-only tooling (view-as switcher, scenario loader, tiny deck) is on in
 * local dev and on Vercel preview deploys, and off in production unless
 * NEXT_PUBLIC_DEV_TOOLS=1 is set (handy for solo-testing a deploy).
 */
export const devToolsEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
  process.env.NEXT_PUBLIC_DEV_TOOLS === "1"
