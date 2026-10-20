import { JoinScreen } from "@/components/screens/join-screen"

export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/join/[code]">) {
  const { code } = await params
  const { create } = await searchParams
  return <JoinScreen code={code.toUpperCase()} creating={create === "1"} />
}
