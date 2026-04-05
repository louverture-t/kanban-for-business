import { Schema, model, type Document, type Types } from 'mongoose';

export interface ISubtask extends Document {
  taskId: Types.ObjectId;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subtaskSchema = new Schema<ISubtask>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

const Subtask = model<ISubtask>('Subtask', subtaskSchema);
export default Subtask;
