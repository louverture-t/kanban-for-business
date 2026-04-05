import { Schema, model, type Document } from 'mongoose';

export interface ITag extends Document {
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: '#6b7280' },
  },
  { timestamps: true },
);

const Tag = model<ITag>('Tag', tagSchema);
export default Tag;
