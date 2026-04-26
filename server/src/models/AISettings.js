import mongoose from 'mongoose';

const aiSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    systemPrompt: {
      type: String,
      default: 'You are an expert software testing specialist and QA automation engineer.',
    },
    model: {
      type: String,
      default: '',
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.2,
    },
    maxTokens: {
      type: Number,
      min: 256,
      max: 8000,
      default: 2000,
    },
  },
  { timestamps: true }
);

aiSettingsSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export default mongoose.model('AISettings', aiSettingsSchema);

