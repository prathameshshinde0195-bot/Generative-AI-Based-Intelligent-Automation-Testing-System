import express from 'express';
import TestRun from '../models/TestRun.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Intelligent Automation Testing System API',
    timestamp: new Date(),
  });
});

router.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is ready',
    status: 'operational',
    timestamp: new Date(),
  });
});

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
  });
});

router.get('/api/version', (req, res) => {
  res.status(200).json({
    success: true,
    version: '1.0.0',
    name: 'Intelligent Automation Testing System',
  });
});

router.get('/api/metrics/test-runs', async (_req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [runs, endpointHotspots] = await Promise.all([
      TestRun.find({ createdAt: { $gte: last24h }, runType: 'realtime-tc' }),
      TestRun.aggregate([
        { $match: { createdAt: { $gte: last24h }, runType: 'realtime-tc' } },
        { $unwind: '$tcCheckResults' },
        { $group: { _id: '$tcCheckResults.endpoint', failures: { $sum: { $cond: ['$tcCheckResults.passed', 0, 1] } } } },
        { $sort: { failures: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const total = runs.length;
    const passed = runs.filter((r) => r.status === 'Passed').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const durations = runs.map((r) => r.durationMs || 0).filter(Boolean).sort((a, b) => a - b);
    const medianDurationMs = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
    const flakyRate = total > 0
      ? Math.round(
          (runs.filter((r) => (r.tcCheckSummary?.flakyCount || 0) > 0).length / total) * 100
        )
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRuns24h: total,
        passRate,
        medianDurationMs,
        flakyRate,
        endpointFailureHotspots: endpointHotspots.map((e) => ({ endpoint: e._id || 'unknown', failures: e.failures || 0 })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load metrics' });
  }
});

export default router;
