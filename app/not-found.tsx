import Link from "next/link"

import { StatusScreen } from "@/components/game/status-screen"
import { AppHeader } from "@/components/screens/app-header"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center px-4 py-10">
        <StatusScreen
          kind="empty"
          title="Nothing here"
          description="That page doesn't exist. Start or join a room instead."
        >
          <Link href="/" className={buttonVariants()}>
            Back home
          </Link>
        </StatusScreen>
      </main>
    </>
  )
}
