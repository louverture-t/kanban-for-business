import { Schema, model, type Document } from 'mongoose';
import { hashPassword } from '@server/utils/auth.js';

export interface IUser extends Document {
  username: string;
  email?: string;
  password: string;
  role: 'superadmin' | 'manager' | 'user';
  active: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
  mustChangePassword: boolean;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      default: 'user',
      enum: ['superadmin', 'manager', 'user'],
    },
    active: { type: Boolean, required: true, default: true },
    failedAttempts: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date },
    mustChangePassword: { type: Boolean, required: true, default: false },
    refreshTokenHash: { type: String },
  },
  { timestamps: true },
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await hashPassword(this.password);
  }
});

const User = model<IUser>('User', userSchema);
export default User;
