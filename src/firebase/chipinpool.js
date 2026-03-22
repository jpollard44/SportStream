import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions()

/**
 * Creates a ChipInPool checkout session for a tournament or league team's entry fee,
 * then emails and texts each player the shared pool link.
 *
 * @param {Object} params
 * @param {'tournaments'|'leagues'} params.col
 * @param {string} params.parentId  — tourId or leagueId
 * @param {string} params.teamId
 * @param {number} params.amount    — total entry fee in USD
 * @param {string} params.productTitle
 * @param {string} [params.managerEmail]
 * @returns {Promise<{ sessionId, checkoutUrl, feeAmount, netAmount, deadline, notified }>}
 */
export async function createTournamentPool({ col, parentId, teamId, amount, productTitle, managerEmail }) {
  const fn = httpsCallable(functions, 'createTournamentPool')
  const result = await fn({ col, parentId, teamId, amount, productTitle, managerEmail })
  return result.data
}
