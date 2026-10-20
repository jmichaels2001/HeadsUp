import type { Metadata, Viewport } from "next"
import { Fredoka, Nunito } from "next/font/google"

import { DevPanel } from "@/components/dev/dev-panel"
import { devToolsEnabled } from "@/lib/dev-tools"
import { MockRoomProvider } from "@/lib/mock/room-provider"

import "./globals.css"

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] })
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Headbands",
  description: "Guess who you are with your friends, live on video.",
}

export const viewport: Viewport = {
  themeColor: "#fdf8ec",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <MockRoomProvider>
          {children}
          {devToolsEnabled && <DevPanel />}
        </MockRoomProvider>
      </body>
    </html>
  )
}
