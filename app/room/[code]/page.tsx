import { RoomScreen } from "@/components/screens/room-screen"

export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const { code } = await params
  return <RoomScreen code={code.toUpperCase()} />
}
