import { devToolsEnabled } from "@/lib/dev-tools"
import type { Card, Category } from "@/lib/game"

function deck(
  id: string,
  name: string,
  emoji: string,
  description: string,
  cards: [label: string, emoji: string][],
): Category {
  return {
    id,
    name,
    emoji,
    description,
    visibility: "public",
    builtIn: true,
    cards: cards.map(([label, cardEmoji]): Card => ({
      id: `${id}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label,
      emoji: cardEmoji,
    })),
  }
}

export const BUILT_IN_DECKS: Category[] = [
  deck("animals", "Animals", "🦁", "Creatures great and small", [
    ["Penguin", "🐧"],
    ["Giraffe", "🦒"],
    ["Octopus", "🐙"],
    ["Kangaroo", "🦘"],
    ["Sloth", "🦥"],
    ["Flamingo", "🦩"],
    ["Elephant", "🐘"],
    ["Hedgehog", "🦔"],
    ["Shark", "🦈"],
    ["Owl", "🦉"],
    ["Zebra", "🦓"],
    ["Peacock", "🦚"],
  ]),
  deck("history", "Famous Figures", "🏛️", "Legends from history", [
    ["Cleopatra", "👑"],
    ["Albert Einstein", "🧪"],
    ["William Shakespeare", "🪶"],
    ["Marie Curie", "⚛️"],
    ["Leonardo da Vinci", "🎨"],
    ["Napoleon", "🎖️"],
    ["Amelia Earhart", "✈️"],
    ["Mozart", "🎼"],
    ["Joan of Arc", "⚔️"],
    ["Abraham Lincoln", "🎩"],
    ["Frida Kahlo", "🌺"],
    ["Isaac Newton", "🍎"],
  ]),
  deck(
    "storybook",
    "Storybook Characters",
    "📚",
    "Heroes and villains of classic tales",
    [
      ["Sherlock Holmes", "🔍"],
      ["Dracula", "🧛"],
      ["Robin Hood", "🏹"],
      ["Alice in Wonderland", "🐇"],
      ["Peter Pan", "🧚"],
      ["Cinderella", "👠"],
      ["King Arthur", "🗡️"],
      ["Pinocchio", "🤥"],
      ["Frankenstein's Monster", "⚡"],
      ["Captain Hook", "🪝"],
      ["The Big Bad Wolf", "🐺"],
      ["Rapunzel", "💇"],
    ],
  ),
  deck("food", "Food & Snacks", "🍕", "Things you'd want to eat", [
    ["Pizza", "🍕"],
    ["Sushi", "🍣"],
    ["Taco", "🌮"],
    ["Pancakes", "🥞"],
    ["Popcorn", "🍿"],
    ["Croissant", "🥐"],
    ["Ice Cream", "🍦"],
    ["Broccoli", "🥦"],
    ["Hot Dog", "🌭"],
    ["Pretzel", "🥨"],
    ["Dumplings", "🥟"],
    ["Watermelon", "🍉"],
  ]),
]

/** Dev-only deck with too few cards, to demo the "Need more cards" state. */
export const TINY_DECK: Category = deck(
  "tiny",
  "Tiny Test Deck",
  "🧪",
  "Only 3 cards (dev only)",
  [
    ["Moon", "🌙"],
    ["Sun", "☀️"],
    ["Star", "⭐"],
  ],
)

export function getAvailableDecks(): Category[] {
  return devToolsEnabled ? [...BUILT_IN_DECKS, TINY_DECK] : BUILT_IN_DECKS
}

export function findDeck(id: string): Category | undefined {
  return getAvailableDecks().find((d) => d.id === id)
}

/** Deck summaries for pickers. Card lists stay out of the UI. */
export function getDeckSummaries() {
  return getAvailableDecks().map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    description: d.description,
    cardCount: d.cards.length,
  }))
}

export type DeckSummary = ReturnType<typeof getDeckSummaries>[number]
