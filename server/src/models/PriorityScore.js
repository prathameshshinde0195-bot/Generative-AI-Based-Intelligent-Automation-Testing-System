import mongoose from 'mongoose';

const priorityScoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    testCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestCase',
      required: true,
      index: true,
    },
    testCaseId: {
      type: String,
      required: true,
    },
    assignedPriority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
    },
    scoreBreakdown: {
      businessCriticality: Number,
      securityRisk: Number,
      frequencyOfUse: Number,
      requirementComplexity: Number,
      regressionRisk: Number,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    reasoning: String,
    aiEvaluation: String,
    manualAdjustment: Boolean,
    manualAdjustmentReason: String,
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, testCase: 1 },
      { assignedPriority: 1, createdAt: -1 },
    ],
  }
);

export default mongoose.model('PriorityScore', priorityScoreSchema);
