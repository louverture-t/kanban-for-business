import { Schema, model, type Document, type Types } from 'mongoose';

export interface IProjectMember extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  addedAt: Date;
}

const projectMemberSchema = new Schema<IProjectMember>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, required: true, default: Date.now },
});

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const ProjectMember = model<IProjectMember>('ProjectMember', projectMemberSchema);
export default ProjectMember;
