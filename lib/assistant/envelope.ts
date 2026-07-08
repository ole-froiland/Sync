import { randomUUID } from 'crypto'
import { createActionToken } from './action-token'
import {
  actionDescription,
  actionLabel,
  actionRequiresConfirmation,
  actionRequiresServer,
  actionRisk,
  normalizeAssistantAction,
  type SyncAssistantAction,
  type SyncAssistantActionEnvelope,
} from './types'

export function buildActionEnvelopes(userId: string, actions: unknown[]): SyncAssistantActionEnvelope[] {
  return actions
    .map(normalizeAssistantAction)
    .filter((action): action is SyncAssistantAction => Boolean(action))
    .slice(0, 3)
    .map((action) => {
      const requiresConfirmation = actionRequiresConfirmation(action)
      const requiresServer = actionRequiresServer(action)
      return {
        id: randomUUID(),
        action,
        label: actionLabel(action),
        description: actionDescription(action),
        risk: actionRisk(action),
        requiresConfirmation,
        confirmationToken: requiresServer ? createActionToken(userId, action) ?? undefined : undefined,
      }
    })
}
