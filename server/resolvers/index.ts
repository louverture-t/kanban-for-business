import { authResolvers } from './authResolvers.js';
import { folderResolvers } from './folderResolvers.js';
import { projectResolvers } from './projectResolvers.js';
import { taskResolvers } from './taskResolvers.js';
import { subtaskResolvers } from './subtaskResolvers.js';
import { commentResolvers } from './commentResolvers.js';
import { tagResolvers } from './tagResolvers.js';
import { notificationResolvers } from './notificationResolvers.js';
import { adminResolvers } from './adminResolvers.js';
import { aiResolvers } from './aiResolvers.js';
import { toISO, toISORequired } from '@server/utils/dates.js';

// ─── Date normalization ──────────────────────────────────────
//
// The GraphQL schema declares every date field as `String`, but Mongoose
// stores them as native `Date`. Apollo's default String scalar coerces
// Date via valueOf() → epoch-ms number → string (e.g. "1775606400000"),
// which is undocumented and fragile for clients.
//
// These field resolvers force every date field to serialize as ISO-8601
// (e.g. "2026-04-15T00:00:00.000Z"), which is unambiguous and parseable
// by the browser's `new Date(str)`. See server/utils/dates.ts.

const dateFields = <T extends string>(...fields: T[]) =>
  Object.fromEntries(
    fields.map((f) => [f, (parent: Record<string, unknown>) => toISO(parent[f])]),
  ) as Record<T, (parent: Record<string, unknown>) => string | null>;

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...folderResolvers.Query,
    ...projectResolvers.Query,
    ...taskResolvers.Query,
    ...subtaskResolvers.Query,
    ...commentResolvers.Query,
    ...tagResolvers.Query,
    ...notificationResolvers.Query,
    ...adminResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...folderResolvers.Mutation,
    ...projectResolvers.Mutation,
    ...taskResolvers.Mutation,
    ...subtaskResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...tagResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...adminResolvers.Mutation,
    ...aiResolvers.Mutation,
  },
  // ─── Type field resolvers ──────────────────────────────────
  // Existing relationship resolvers are spread first, then date
  // normalizers override any date fields to return ISO-8601 strings.
  // createdAt/updatedAt are declared String! (non-nullable) on the User type.
  // Legacy documents inserted before timestamps were enabled may lack these
  // fields. toISORequired falls back to the ObjectId-embedded timestamp so
  // the GraphQL non-null contract is never violated.
  User: {
    lockedUntil: (parent: Record<string, unknown>) => toISO(parent['lockedUntil']),
    createdAt: (parent: Record<string, unknown>) =>
      toISORequired(parent['createdAt'], () =>
        new Date((parent['_id'] as { getTimestamp(): Date }).getTimestamp())),
    updatedAt: (parent: Record<string, unknown>) =>
      toISORequired(parent['updatedAt'], () =>
        new Date((parent['_id'] as { getTimestamp(): Date }).getTimestamp())),
  },
  Project: {
    ...projectResolvers.Project,
    ...dateFields('startDate', 'endDate', 'createdAt', 'updatedAt'),
  },
  ProjectFolder: dateFields('createdAt', 'updatedAt'),
  ProjectMember: {
    ...projectResolvers.ProjectMember,
    ...dateFields('addedAt'),
  },
  Task: {
    ...taskResolvers.Task,
    ...dateFields(
      'startDate',
      'dueDate',
      'archivedAt',
      'completedAt',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ),
  },
  Subtask: dateFields('createdAt', 'updatedAt'),
  Tag: dateFields('createdAt', 'updatedAt'),
  TaskTag: dateFields('createdAt'),
  Comment: {
    ...commentResolvers.Comment,
    ...dateFields('createdAt', 'updatedAt'),
  },
  AuditLog: dateFields('createdAt'),
  Notification: dateFields('createdAt', 'updatedAt'),
  Invitation: dateFields('expiresAt', 'createdAt', 'updatedAt'),
};
