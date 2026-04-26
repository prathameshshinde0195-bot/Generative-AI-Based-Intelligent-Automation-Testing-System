import mongoose from 'mongoose';

const automationScriptSchema = new mongoose.Schema(
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
    },
    testCaseId: {
      type: String,
      required: true,
      index: true,
    },
    framework: {
      type: String,
      enum: ['selenium-java', 'selenium-python', 'cypress', 'playwright', 'testng', 'junit', 'pytest'],
      required: true,
    },
    language: {
      type: String,
      enum: ['Java', 'Python', 'JavaScript', 'TypeScript', 'C#'],
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    dependencies: [String],
    pageObjects: [String],
    utilities: [String],
    executionStatus: {
      type: String,
      enum: ['Not Executed', 'Executing', 'Passed', 'Failed', 'Timeout'],
      default: 'Not Executed',
    },
    lastExecutionDate: Date,
    executionTime: Number,
    maintenanceNotes: String,
    version: {
      type: Number,
      default: 1,
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, framework: 1, createdAt: -1 },
      { testCaseId: 1, framework: 1 },
    ],
  }
);

export default mongoose.model('AutomationScript', automationScriptSchema);
