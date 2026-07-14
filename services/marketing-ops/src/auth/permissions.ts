import { appError } from '../errors.js';
import type { Actor, ActorRole } from './actor.js';

export type Permission =
  | 'campaign.create' | 'campaign.read' | 'campaign.update'
  | 'campaign.transition' | 'campaign.reopen' | 'campaign.archive'
  | 'item.create' | 'item.read' | 'item.update' | 'audit.read' | 'membership.manage';

const matrix: Record<Permission, readonly ActorRole[]> = {
  'campaign.create': ['member', 'manager', 'admin'],
  'campaign.read': ['member', 'manager', 'admin'],
  'campaign.update': ['member', 'manager', 'admin'],
  'campaign.transition': ['member', 'manager', 'admin'],
  'campaign.reopen': ['manager', 'admin'],
  'campaign.archive': ['manager', 'admin'],
  'item.create': ['member', 'manager', 'admin'],
  'item.read': ['member', 'manager', 'admin'],
  'item.update': ['member', 'manager', 'admin'],
  'audit.read': ['manager', 'admin'],
  'membership.manage': ['admin']
};

export function authorize(actor: Pick<Actor, 'role'>, permission: Permission): void {
  if (!matrix[permission].includes(actor.role)) {
    throw appError('forbidden', 403, `Role does not grant permission ${permission}`, { permission });
  }
}
