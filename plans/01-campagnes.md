# Plan : Feature "Campagnes"

## Context

Ajouter un système de campagnes à l'app. Une campagne regroupe des joueurs autour d'un MJ (le créateur). Le MJ peut voir les fiches des joueurs (lecture seule). Pour l'instant on ignore la partie "rencontres".

---

## 1. Database — Nouvelles tables

**Fichier** : `server/src/db/schema.ts`

### Table `campaigns`
| Colonne | Type | Notes |
|---------|------|-------|
| id | serial PK | |
| name | varchar(100) | NOT NULL |
| gmUserId | integer FK→users | ON DELETE CASCADE |
| createdAt | timestamp | default now() |

### Table `campaignMembers`
| Colonne | Type | Notes |
|---------|------|-------|
| id | serial PK | |
| campaignId | integer FK→campaigns | ON DELETE CASCADE |
| userId | integer FK→users | ON DELETE CASCADE |
| characterId | integer FK→characters | nullable, ON DELETE SET NULL |
| joinedAt | timestamp | default now() |
| unique | (campaignId, userId) | un joueur ne peut rejoindre qu'une fois |

---

## Statut : IMPLÉMENTÉ
