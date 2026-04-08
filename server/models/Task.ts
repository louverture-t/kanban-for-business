import { Schema, model, type Document, type Types } from 'mongoose';

export interface ITask extends Document {
  projectId: Types.ObjectId;
  title: string;
  description?: string;
  status: 'backlog' | 'active' | 'review' | 'complete';
  priority: 'high' | 'medium' | 'low';
  startDate?: Date;
  dueDate?: Date;
  assigneeId?: Types.ObjectId;
  position: number;
  createdBy?: Types.ObjectId;
  archivedAt?: Date;
  completedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      required: true,
      default: 'backlog',
      enum: ['backlog', 'active', 'review', 'complete'],
    },
    priority: {
      type: String,
      required: true,
      default: 'medium',
      enum: ['high', 'medium', 'low'],
    },
    startDate: { type: Date },
    dueDate: { type: Date },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    position: { type: Number, required: true, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date },
    completedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

taskSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 3 }, name: 'task_text_idx' },
);
taskSchema.index({ projectId: 1, status: 1 });

const Task = model<ITask>('Task', taskSchema);
export default Task;
