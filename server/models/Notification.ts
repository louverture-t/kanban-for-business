import { Schema, model, type Document, type Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: 'assignment' | 'comment' | 'due_date' | 'ai_complete';
  content: string;
  read: boolean;
  taskId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: ['assignment', 'comment', 'due_date', 'ai_complete'],
    },
    content: { type: String, required: true },
    read: { type: Boolean, required: true, default: false },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  },
  { timestamps: true },
);

const Notification = model<INotification>('Notification', notificationSchema);
export default Notification;
