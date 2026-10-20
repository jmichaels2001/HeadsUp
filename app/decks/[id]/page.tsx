import { DeckEditor } from "@/components/decks/deck-editor"

export default async function EditDeckPage({
  params,
}: PageProps<"/decks/[id]">) {
  const { id } = await params
  return <DeckEditor deckId={id} />
}
