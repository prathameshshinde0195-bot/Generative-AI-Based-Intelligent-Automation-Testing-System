import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema(
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
    testCaseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requirement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requirement',
    },
    requirementId: {
      type: String,
    },
    scenario: {
      type: String,
      required: true,
    },
    preconditions: [String],
    steps: [String],
    expectedResults: String,
    actualResults: String,
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium',
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    category: {
      type: String,
      enum: ['functional', 'negative', 'edge', 'security', 'boundary', 'performance', 'integration'],
      default: 'functional',
    },
    tags: [String],
    status: {
      type: String,
      enum: ['Draft', 'Ready', 'Executing', 'Passed', 'Failed', 'Blocked'],
      default: 'Draft',
    },
    automationStatus: {
      type: String,
      enum: ['Not Automated', 'Automated', 'In Progress', 'Failed'],
      default: 'Not Automated',
    },
    estimatedEffort: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    executedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    executionDate: Date,
    result: {
      type: String,
      enum: ['Pass', 'Fail', 'Blocked', 'Not Executed'],
      default: 'Not Executed',
    },
    defects: [{
      defectId: String,
      description: String,
      severity: String,
    }],
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      text: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, projectId: 1, createdAt: -1 },
      { testCaseId: 1 },
      { requirement: 1 },
      { priority: 1, status: 1 },
    ],
  }
);

export default mongoose.model('TestCase', testCaseSchema);
