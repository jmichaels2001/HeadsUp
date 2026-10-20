import { shuffle } from "./random"
import type { Card, Player, PlayerId } from "./types"

function created(card: Card, player: Player): boolean {
  return !!player.deviceId && !!card.creators?.includes(player.deviceId)
}

/**
 * Deal one card per player so nobody gets a card they created. The deck is
 * shuffled by `seed`; each player takes the first free card they may have,
 * and only when someone is stuck do earlier players swap (augmenting-path
 * matching), so a fair deal is always found if one exists. Without creators
 * this is the same as handing out the shuffled deck in order.
 *
 * Returns null when no fair deal exists.
 */
export function dealCards(
  players: readonly Player[],
  cards: readonly Card[],
  seed: number,
): Record<PlayerId, Card> | null {
  const deck = shuffle(cards, seed)
  // owner[c] = index of the player holding deck[c], or -1.
  const owner = deck.map(() => -1)

  const take = (p: number, seen: boolean[]): boolean => {
    for (let c = 0; c < deck.length; c++) {
      if (owner[c] === -1 && !created(deck[c], players[p])) {
        owner[c] = p
        return true
      }
    }
    for (let c = 0; c < deck.length; c++) {
      if (seen[c] || created(deck[c], players[p])) continue
      seen[c] = true
      if (take(owner[c], seen)) {
        owner[c] = p
        return true
      }
    }
    return false
  }

  for (let p = 0; p < players.length; p++) {
    const seen = deck.map(() => false)
    if (!take(p, seen)) return null
  }

  const assignments: Record<PlayerId, Card> = {}
  owner.forEach((p, c) => {
    if (p !== -1) assignments[players[p].id] = deck[c]
  })
  return assignments
}

/** Whether every player can get a card they didn't create. */
export function canDealFairly(
  players: readonly Player[],
  cards: readonly Card[],
): boolean {
  return dealCards(players, cards, 0) !== null
}
