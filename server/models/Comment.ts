import { Schema, model, type Document, type Types } from 'mongoose';

export interface IComment extends Document {
  taskId: Types.ObjectId;
  content: string;
  authorId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    content: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

const Comment = model<IComment>('Comment', commentSchema);
export default Comment;
