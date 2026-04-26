import mongoose from 'mongoose';

const artifactSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    path: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  { _id: false }
);

const tcCheckResultSchema = new mongoose.Schema(
  {
    testCaseId: { type: String, default: '' },
    scenario: { type: String, default: '' },
    variantLabel: { type: String, default: 'default' },
    endpoint: { type: String, default: '' },
    method: { type: String, default: 'GET' },
    expectedStatus: { type: Number, default: 200 },
    actualStatus: { type: Number, default: null },
    expectedText: { type: String, default: '' },
    textMatched: { type: Boolean, default: false },
    passed: { type: Boolean, default: false },
    message: { type: String, default: '' },
    requestSnippet: { type: String, default: '' },
    responseSnippet: { type: String, default: '' },
    retriesUsed: { type: Number, default: 0 },
    checkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const testRunSchema = new mongoose.Schema(
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
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    framework: {
      type: String,
      enum: ['playwright', 'cypress', 'selenium', 'other'],
      default: 'other',
    },
    runType: {
      type: String,
      enum: ['command', 'realtime-tc'],
      default: 'command',
      index: true,
    },
    command: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Queued', 'Running', 'Passed', 'Failed', 'Cancelled', 'Created'],
      default: 'Created',
      index: true,
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    exitCode: { type: Number, default: null },
    stdout: { type: String, default: '' },
    stderr: { type: String, default: '' },
    artifacts: { type: [artifactSchema], default: [] },
    externalUrl: { type: String, default: '' },
    triggeredBy: { type: String, default: 'manual' }, // manual|api|ci
    processPid: { type: Number, default: null },
    realtimeConfig: {
      targetBaseUrl: { type: String, default: '' },
      variants: {
        type: [
          {
            label: { type: String, default: 'default' },
            method: { type: String, default: 'GET' },
            body: { type: mongoose.Schema.Types.Mixed, default: null },
            headers: { type: mongoose.Schema.Types.Mixed, default: null },
            query: { type: mongoose.Schema.Types.Mixed, default: null },
            expectedStatus: { type: Number, default: 200 },
            expectedText: { type: String, default: '' },
            assertionType: { type: String, default: 'status+text' },
            assertionJsonPath: { type: String, default: '' },
            assertionExpectedValue: { type: String, default: '' },
            maxRetries: { type: Number, default: 0 },
          },
        ],
        default: [],
      },
      checks: {
        type: [
          {
            testCaseId: { type: String, default: '' },
            endpoint: { type: String, default: '' },
            method: { type: String, default: 'GET' },
            expectedStatus: { type: Number, default: 200 },
            expectedText: { type: String, default: '' },
            variants: {
              type: [
                {
                  label: { type: String, default: 'default' },
                  method: { type: String, default: 'GET' },
                  body: { type: mongoose.Schema.Types.Mixed, default: null },
                  headers: { type: mongoose.Schema.Types.Mixed, default: null },
                  query: { type: mongoose.Schema.Types.Mixed, default: null },
                  expectedStatus: { type: Number, default: 200 },
                  expectedText: { type: String, default: '' },
                  assertionType: { type: String, default: 'status+text' },
                  assertionJsonPath: { type: String, default: '' },
                  assertionExpectedValue: { type: String, default: '' },
                  maxRetries: { type: Number, default: 0 },
                },
              ],
              default: [],
            },
          },
        ],
        default: [],
      },
    },
    tcCheckSummary: {
      total: { type: Number, default: 0 },
      passed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      flakyCount: { type: Number, default: 0 },
      confidenceScore: { type: Number, default: 0 },
    },
    tcCheckResults: { type: [tcCheckResultSchema], default: [] },
  },
  {
    timestamps: true,
    indexes: [{ userId: 1, projectId: 1, createdAt: -1 }],
  }
);

export default mongoose.model('TestRun', testRunSchema);

