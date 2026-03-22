import { getGameByJoinCode } from '../firebase/firestore'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/I/1 for readability

function randomCode() {
  let code = ''
  const array = new Uint8Array(6)
  crypto.getRandomValues(array)
  for (const byte of array) {
    code += CHARS[byte % CHARS.length]
  }
  return code
}

export async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const existing = await getGameByJoinCode(code)
    if (!existing) return code
  }
  throw new Error('Failed to generate unique join code after 5 attempts')
}
