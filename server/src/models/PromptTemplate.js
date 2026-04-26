import mongoose from 'mongoose';

const promptTemplateSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      enum: [
        'generate_test_cases',
        'detect_ambiguities',
        'prioritize_tests',
        'generate_negative_test_cases',
        'assess_risk',
      ],
    },
    template: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    indexes: [{ userId: 1, projectId: 1, action: 1, isDefault: 1 }],
  }
);

promptTemplateSchema.index(
  { userId: 1, projectId: 1, name: 1, action: 1 },
  { unique: true, partialFilterExpression: { archivedAt: null } }
);

export default mongoose.model('PromptTemplate', promptTemplateSchema);

