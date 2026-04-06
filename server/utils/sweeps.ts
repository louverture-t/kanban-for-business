import { Task, Subtask, Comment, TaskTag, AuditLog } from '@server/models/index.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function runArchiveSweep(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const result = await Task.updateMany(
    {
      status: 'complete',
      completedAt: { $lt: sevenDaysAgo },
      archivedAt: null,
      deletedAt: null,
    },
    { archivedAt: new Date() },
  );

  return result.modifiedCount;
}

export async function runPurgeSweep(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  const tasksToPurge = await Task.find({
    $or: [
      { deletedAt: { $lt: sevenDaysAgo } },
      { archivedAt: { $lt: thirtyDaysAgo } },
    ],
  }).select('_id');

  const taskIds = tasksToPurge.map((t) => t._id);

  if (taskIds.length === 0) {
    return 0;
  }

  await Promise.all([
    Subtask.deleteMany({ taskId: { $in: taskIds } }),
    Comment.deleteMany({ taskId: { $in: taskIds } }),
    TaskTag.deleteMany({ taskId: { $in: taskIds } }),
    AuditLog.deleteMany({ taskId: { $in: taskIds } }),
  ]);

  const result = await Task.deleteMany({ _id: { $in: taskIds } });
  return result.deletedCount;
}
