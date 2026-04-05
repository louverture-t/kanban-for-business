import { Schema, model, type Document, type Types } from 'mongoose';

export interface ITaskTag extends Document {
  taskId: Types.ObjectId;
  tagId: Types.ObjectId;
  createdAt: Date;
}

const taskTagSchema = new Schema<ITaskTag>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true },
  },
  { timestamps: true },
);

taskTagSchema.index({ taskId: 1, tagId: 1 }, { unique: true });

const TaskTag = model<ITaskTag>('TaskTag', taskTagSchema);
export default TaskTag;
