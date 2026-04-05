import { Schema, model, type Document, type Types } from 'mongoose';

export interface IInvitation extends Document {
  email: string;
  token: string;
  role: 'superadmin' | 'manager' | 'user';
  projectId?: Types.ObjectId;
  invitedBy: Types.ObjectId;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    token: { type: String, required: true, unique: true },
    role: {
      type: String,
      required: true,
      default: 'user',
      enum: ['superadmin', 'manager', 'user'],
    },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'accepted', 'expired'],
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

const Invitation = model<IInvitation>('Invitation', invitationSchema);
export default Invitation;
