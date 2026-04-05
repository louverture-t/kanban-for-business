import { Schema, model, type Document, type Types } from 'mongoose';

export interface IAuditLog extends Document {
  taskId?: Types.ObjectId;
  userId?: Types.ObjectId;
  action: string;
  userName: string;
  changes?: string;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    userName: { type: String, required: true },
    changes: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
