import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import logger from '../src/utils/logger.js';

dotenv.config({ path: '../.env' });

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-testing-system');
    console.log('✅ MongoDB connected');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'admin@test.com' });
    if (existingUser) {
      console.log('⚠️  User admin@test.com already exists in database');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create sample user
    const defaultUser = new User({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Admin@123',
      company: 'Test Company',
      department: 'QA',
      role: 'Admin',
      isActive: true,
    });

    await defaultUser.save();
    console.log('✅ Default user created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@test.com');
    console.log('   Password: Admin@123');

    // Create additional QA user
    const qaUser = new User({
      name: 'QA User',
      email: 'qa@test.com',
      password: 'QA@123',
      company: 'Test Company',
      department: 'QA',
      role: 'QA',
      isActive: true,
    });

    await qaUser.save();
    console.log('✅ QA user created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: qa@test.com');
    console.log('   Password: QA@123');

    await mongoose.connection.close();
    console.log('\n✅ Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
