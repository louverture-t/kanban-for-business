import { Schema, model, type Document, type Types } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  color: string;
  category?: 'clinical' | 'business' | 'hr' | 'compliance' | 'it';
  startDate?: Date;
  endDate?: Date;
  createdBy?: Types.ObjectId;
  folderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      required: true,
      default: 'active',
      enum: ['active', 'paused', 'completed'],
    },
    color: { type: String, required: true, default: '#3b82f6' },
    category: {
      type: String,
      enum: ['clinical', 'business', 'hr', 'compliance', 'it'],
    },
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    folderId: { type: Schema.Types.ObjectId, ref: 'ProjectFolder' },
  },
  { timestamps: true },
);

const Project = model<IProject>('Project', projectSchema);
export default Project;
