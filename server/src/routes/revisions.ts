import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../auth/middleware.js'
import { isEntityType } from '../revisions/registry.js'
import { getRevision, listRevisions, restoreRevision } from '../revisions/service.js'

const router = Router()
router.use(requireAuth)

function parse(req: unknown, params: { type?: string; id?: string; revisionId?: string }) {
  const userId = (req as AuthRequest).userId!
  const id = Number(params.id)
  const revisionId = params.revisionId === undefined ? null : Number(params.revisionId)
  const ok =
    isEntityType(params.type) &&
    Number.isInteger(id) &&
    id > 0 &&
    (revisionId === null || (Number.isInteger(revisionId) && revisionId > 0))
  return { userId, type: params.type as never, id, revisionId, ok }
}

// GET /api/revisions/:type/:id — l'historique (métadonnées seules)
router.get('/:type/:id', async (req, res) => {
  const p = parse(req, req.params)
  if (!p.ok) { res.status(400).json({ error: 'Paramètres invalides' }); return }

  const list = await listRevisions(p.type, p.id, p.userId)
  if (!list) { res.status(403).json({ error: 'Non autorisé' }); return }
  res.json(list)
})

// GET /api/revisions/:type/:id/:revisionId — le contenu d'une version (aperçu)
router.get('/:type/:id/:revisionId', async (req, res) => {
  const p = parse(req, req.params)
  if (!p.ok || p.revisionId === null) { res.status(400).json({ error: 'Paramètres invalides' }); return }

  const snapshot = await getRevision(p.type, p.id, p.revisionId, p.userId)
  if (snapshot === 'forbidden') { res.status(403).json({ error: 'Non autorisé' }); return }
  if (!snapshot) { res.status(404).json({ error: 'Version introuvable' }); return }
  res.json({ id: p.revisionId, snapshot })
})

// POST /api/revisions/:type/:id/restore/:revisionId
router.post('/:type/:id/restore/:revisionId', async (req, res) => {
  const p = parse(req, req.params)
  if (!p.ok || p.revisionId === null) { res.status(400).json({ error: 'Paramètres invalides' }); return }

  const result = await restoreRevision({ type: p.type, id: p.id, revisionId: p.revisionId, userId: p.userId })
  switch (result.status) {
    case 'ok':
      res.json({ ok: true, version: result.version })
      return
    case 'not_found':
      res.status(404).json({ error: 'Version introuvable' })
      return
    case 'forbidden':
      res.status(403).json({ error: 'Non autorisé' })
      return
    case 'locked':
      res.status(423).json({ error: `${result.lockedBy} est en train d'éditer.` })
      return
    default:
      res.status(409).json({ error: 'Conflit de version' })
  }
})

export default router
