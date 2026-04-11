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
    {
      username: 'user1',
      password: 'User1@123',
      role: 'user',
      mustChangePassword: false,
    },
    {
      username: 'user2',
      password: 'User2@123',
      role: 'user',
      mustChangePassword: false,
    },
  ]);

  console.log('🌱 Seeded: superadmin (Admin@123), admin (admin123), user1 (User1@123), user2 (User2@123)');
}
