import type { Metadata } from "next"

import {
  AdminNotConfigured,
  AdminScreen,
  AdminSignIn,
} from "@/components/admin/admin-screen"
import { getAdminService } from "@/lib/server"
import { adminConfigured, isAdmin } from "@/lib/server/admin-auth"

export const metadata: Metadata = {
  title: "Moderation · Headbands",
  robots: { index: false },
}

/** Data is loaded here on the server, only after the admin cookie checks out. */
export default async function AdminPage() {
  if (!adminConfigured()) return <AdminNotConfigured />
  if (!(await isAdmin())) return <AdminSignIn />
  return <AdminScreen decks={await getAdminService().listFlagged()} />
}
