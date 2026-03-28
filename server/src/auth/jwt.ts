import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET!

export function signToken(userId: number, username: string): string {
  return jwt.sign({ sub: userId, username }, secret, { expiresIn: '365d' })
}

export function verifyToken(token: string): { sub: number; username: string } {
  const payload = jwt.verify(token, secret)
  if (typeof payload !== 'object' || payload === null || typeof payload.sub !== 'number') {
    throw new Error('Invalid token payload')
  }
  return { sub: payload.sub, username: typeof payload.username === 'string' ? payload.username : 'unknown' }
}
