import { User } from '@server/models/index.js';

export async function seedDatabase(): Promise<void> {
  const userCount = await User.countDocuments();

  if (userCount > 0) {
    return;
  }

  // Password is hashed by User pre-save hook
  await User.create([
    {
      username: 'superadmin',
      password: 'Admin@123',
      role: 'superadmin',
      mustChangePassword: false,
    },
    {
      username: 'admin',
      password: 'admin123',
      role: 'manager',
      mustChangePassword: false,
    },
  ]);

  console.log('🌱 Seeded: superadmin (Admin@123) and admin (admin123)');
}
