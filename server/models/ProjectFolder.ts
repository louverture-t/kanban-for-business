import { Schema, model, type Document } from 'mongoose';

export interface IProjectFolder extends Document {
  name: string;
  color: string;
  createdAt: Date;
}

const projectFolderSchema = new Schema<IProjectFolder>(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: '#6b7280' },
  },
  { timestamps: true },
);

const ProjectFolder = model<IProjectFolder>('ProjectFolder', projectFolderSchema);
export default ProjectFolder;
