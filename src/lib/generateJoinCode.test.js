import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../firebase/firestore', () => ({
  getGameByJoinCode: vi.fn(),
}))

import { generateUniqueJoinCode } from './generateJoinCode'
import { getGameByJoinCode } from '../firebase/firestore'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateUniqueJoinCode', () => {
  it('returns a 6-character code from the ambiguity-free alphabet', async () => {
    getGameByJoinCode.mockResolvedValue(null)
    const code = await generateUniqueJoinCode()
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    expect(getGameByJoinCode).toHaveBeenCalledTimes(1)
  })

  it('retries on collision', async () => {
    getGameByJoinCode
      .mockResolvedValueOnce({ id: 'existing-game' })
      .mockResolvedValueOnce(null)
    const code = await generateUniqueJoinCode()
    expect(code).toHaveLength(6)
    expect(getGameByJoinCode).toHaveBeenCalledTimes(2)
  })

  it('gives up after 5 collisions', async () => {
    getGameByJoinCode.mockResolvedValue({ id: 'existing-game' })
    await expect(generateUniqueJoinCode()).rejects.toThrow(/unique join code/)
    expect(getGameByJoinCode).toHaveBeenCalledTimes(5)
  })
})
