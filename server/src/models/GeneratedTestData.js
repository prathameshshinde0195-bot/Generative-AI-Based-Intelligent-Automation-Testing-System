import mongoose from 'mongoose';

const generatedTestDataSchema = new mongoose.Schema(
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
    requirement: {
      type: String,
      required: true,
    },
    testCaseId: {
      type: String,
      index: true,
      default: '',
    },
    testCaseTitle: {
      type: String,
      default: '',
    },
    selectedCategories: [String],
    structuredItems: [
      {
        testDataId: String,
        relatedTestCaseId: String,
        fieldName: String,
        value: String,
        category: String,
        expectedValidation: String,
        expectedOutcome: String,
        boundaryClassification: String,
        requirementReference: String,
      },
    ],
    valid: [String],
    invalid: [String],
    boundary: [String],
    edge: [String],
    security: [String],
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, projectId: 1, createdAt: -1 },
      { userId: 1, testCaseId: 1 },
    ],
  }
);

export default mongoose.model('GeneratedTestData', generatedTestDataSchema);
