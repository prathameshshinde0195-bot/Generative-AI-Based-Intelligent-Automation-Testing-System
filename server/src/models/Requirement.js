import mongoose from 'mongoose';

const requirementSchema = new mongoose.Schema(
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
    requirementId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['Functional', 'Non-Functional', 'Security', 'Performance', 'Usability', 'Other'],
      default: 'Functional',
    },
    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Draft', 'Approved', 'In Progress', 'Completed'],
      default: 'Draft',
    },
    ambiguities: [{
      phrase: String,
      reason: String,
      suggestion: String,
      severity: {
        type: String,
        enum: ['high', 'medium', 'low'],
      },
    }],
    attachments: [{
      filename: String,
      url: String,
      uploadDate: Date,
    }],
    relatedRequirements: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requirement',
    }],
    aiSummary: {
      type: String,
    },
    rawContent: {
      type: String,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 },
      { projectId: 1, requirementId: 1 },
      { status: 1 },
    ],
  }
);

export default mongoose.model('Requirement', requirementSchema);
