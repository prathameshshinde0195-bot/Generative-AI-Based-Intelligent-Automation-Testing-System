import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const isCloudOrProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.VERCEL);

  const defaultAtlasUri = 'mongodb+srv://genai_user:TestPass12345@cluster0.szjtmxo.mongodb.net/ai-testing-system?retryWrites=true&w=majority';
  const rawUri = process.env.MONGODB_URI;
  const uriToUse =
    rawUri && !rawUri.includes('localhost') && !rawUri.includes('127.0.0.1')
      ? rawUri
      : isCloudOrProduction
      ? defaultAtlasUri
      : rawUri || 'mongodb://localhost:27017/ai-testing-system';


  try {
    const conn = await mongoose.connect(uriToUse, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    if (isCloudOrProduction) {
      logger.warn('⚠️ MongoDB connection could not be established. Server continuing to operate for health checks and API endpoints.');
      return null;
    }
    throw error;
  }
};

export default connectDB;
