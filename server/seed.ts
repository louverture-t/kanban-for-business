import { User } from '@server/models/index.js';

const SUPERADMIN_USERNAME = 'superadmin';
const SUPERADMIN_PASSWORD = 'Admin@123';

export async function seedDatabase(): Promise<void> {
  const userCount = await User.countDocuments();

  if (userCount > 0) {
    return;
  }

  // Password is hashed by User pre-save hook
  await User.create({
    username: SUPERADMIN_USERNAME,
    password: SUPERADMIN_PASSWORD,
    role: 'superadmin',
    mustChangePassword: true,
  });

  console.log('🌱 Seeded superadmin user (must change password on first login)');
}
