import TestCase from '../models/TestCase.js';
import { catchAsync } from '../middleware/error.js';
import logger from '../utils/logger.js';

export const createTestCase = catchAsync(async (req, res) => {
  const { projectId: bodyProjectId, scenario, preconditions, steps, expectedResults, priority, category } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!projectId || !scenario || !expectedResults) {
    return res.status(400).json({
      success: false,
      message: 'Project ID, scenario, and expected results are required',
    });
  }

  const testCase = new TestCase({
    userId: req.user.id,
    projectId,
    testCaseId: `TC-${Date.now()}`,
    scenario,
    preconditions: preconditions || [],
    steps: steps || [],
    expectedResults,
    priority: priority || 'Medium',
    category: category || 'functional',
    status: 'Draft',
  });

  await testCase.save();

  res.status(201).json({
    success: true,
    message: 'Test case created successfully',
    data: testCase,
  });
});

export const getTestCases = catchAsync(async (req, res) => {
  const { projectId: queryProjectId, priority, status, category } = req.query;
  const projectId = queryProjectId || req.projectId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const query = { userId: req.user.id };
  if (projectId) query.projectId = projectId;
  if (priority) query.priority = priority;
  if (status) query.status = status;
  if (category) query.category = category;

  const skip = (page - 1) * limit;

  const [testCases, total] = await Promise.all([
    TestCase.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    TestCase.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: testCases,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getTestCaseById = catchAsync(async (req, res) => {
  const testCase = await TestCase.findById(req.params.id);

  if (!testCase || testCase.userId.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Test case not found',
    });
  }

  res.status(200).json({
    success: true,
    data: testCase,
  });
});

export const updateTestCase = catchAsync(async (req, res) => {
  let testCase = await TestCase.findById(req.params.id);

  if (!testCase || testCase.userId.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Test case not found',
    });
  }

  testCase = await TestCase.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Test case updated successfully',
    data: testCase,
  });
});

export const deleteTestCase = catchAsync(async (req, res) => {
  const testCase = await TestCase.findById(req.params.id);

  if (!testCase || testCase.userId.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Test case not found',
    });
  }

  await TestCase.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Test case deleted successfully',
  });
});

export const bulkDeleteTestCases = catchAsync(async (req, res) => {
  const { testCaseIds } = req.body;
  const projectId = req.body?.projectId || req.projectId;

  if (!testCaseIds || testCaseIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Test case IDs are required',
    });
  }

  const result = await TestCase.deleteMany({
    _id: { $in: testCaseIds },
    userId: req.user.id,
    ...(projectId ? { projectId } : {}),
  });

  res.status(200).json({
    success: true,
    message: `Deleted ${result.deletedCount} test cases`,
    data: { deletedCount: result.deletedCount },
  });
});

export const exportTestCases = catchAsync(async (req, res) => {
  const { projectId: queryProjectId, format } = req.query;
  const projectId = queryProjectId || req.projectId;

  if (!format || !['csv', 'excel', 'json'].includes(format)) {
    return res.status(400).json({
      success: false,
      message: 'Valid format (csv, excel, json) is required',
    });
  }

  const query = { userId: req.user.id };
  if (projectId) query.projectId = projectId;

  const testCases = await TestCase.find(query);

  const filename = `test-cases-${Date.now()}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.send(JSON.stringify(testCases, null, 2));
  }

  if (format === 'csv') {
    const csv = convertToCSV(testCases);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  // Excel format would require xlsx library
  res.status(400).json({
    success: false,
    message: 'Excel export requires additional configuration',
  });
});

function convertToCSV(testCases) {
  const headers = ['Test Case ID', 'Scenario', 'Priority', 'Category', 'Status', 'Expected Results'];
  const rows = testCases.map(tc => [
    tc.testCaseId,
    tc.scenario,
    tc.priority,
    tc.category,
    tc.status,
    tc.expectedResults,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}
