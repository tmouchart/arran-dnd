import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET!

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, secret)
}

export function verifyToken(token: string): { sub: number } {
  const payload = jwt.verify(token, secret)
  if (typeof payload !== 'object' || payload === null || typeof payload.sub !== 'number') {
    throw new Error('Invalid token payload')
  }
  return { sub: payload.sub }
}
