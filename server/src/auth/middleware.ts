import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from './jwt.js'

export interface AuthRequest extends Request {
  userId: number
  username: string
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req as { cookies?: { token?: string } }).cookies?.token
  if (!token) {
    res.status(401).json({ error: 'Non authentifié' })
    return
  }
  try {
    const payload = verifyToken(token)
    ;(req as AuthRequest).userId = payload.sub
    ;(req as AuthRequest).username = payload.username
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
}
