import { JoinScreen } from "@/components/screens/join-screen"

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params
  return <JoinScreen code={code.toUpperCase()} />
}
