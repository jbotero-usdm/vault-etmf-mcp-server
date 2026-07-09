import { vqlQuery } from '../lib/vault.js';

export default async function handler(req, res) {
  try {
    // Check Vault connectivity with a simple query
    const connectStart = Date.now();
    const pingVql = `SELECT COUNT(id) AS total FROM documents LIMIT 1`;
    const pingResult = await vqlQuery(pingVql);
    const connectMs = Date.now() - connectStart;

    // Document counts by status
    const statusVql = `
      SELECT status__v, COUNT(id) AS doc_count
      FROM documents
      GROUP BY status__v
    `;

    // Documents modified in last 24 hours (indexing activity)
    const recentVql = `
      SELECT COUNT(id) AS doc_count
      FROM documents
      WHERE last_modified_date__v >= DATEADD(day, -1, NOW())
    `;

    // Documents modified in last 7 days
    const weekVql = `
      SELECT COUNT(id) AS doc_count
      FROM documents
      WHERE last_modified_date__v >= DATEADD(day, -7, NOW())
    `;

    // Stale unclassified docs (inbox > 7 days)
    const staleVql = `
      SELECT COUNT(id) AS doc_count
      FROM documents
      WHERE status__v = 'unclassified__v'
        AND created_date__v <= DATEADD(day, -7, NOW())
    `;

    const [statuses, recent, week, stale] = await Promise.all([
      vqlQuery(statusVql),
      vqlQuery(recentVql),
      vqlQuery(weekVql),
      vqlQuery(staleVql),
    ]);

    // Parse counts
    const totalDocs = pingResult[0]?.total || 0;
    const last24h = recent[0]?.doc_count || 0;
    const last7d = week[0]?.doc_count || 0;
    const staleInbox = stale[0]?.doc_count || 0;

    // Status breakdown
    const statusBreakdown = {};
    for (const s of statuses) {
      statusBreakdown[s.status__v || 'unknown'] = s.doc_count || 0;
    }

    const unclassified = statusBreakdown['unclassified__v'] || 0;
    const inQc = statusBreakdown['in_qc_review__v'] || 0;

    // Health score: 100 = perfect, deduct for issues
    let healthScore = 100;
    const issues = [];

    if (staleInbox > 0) {
      healthScore -= Math.min(30, staleInbox * 3);
      issues.push(`${staleInbox} documents in inbox > 7 days (approaching filing deadline)`);
    }
    if (unclassified > 20) {
      healthScore -= 10;
      issues.push(`${unclassified} unclassified documents in inbox`);
    }
    if (inQc > 10) {
      healthScore -= 10;
      issues.push(`${inQc} documents stuck in QC review`);
    }
    if (last24h === 0) {
      healthScore -= 15;
      issues.push('No document activity in the last 24 hours');
    }
    if (connectMs > 5000) {
      healthScore -= 10;
      issues.push(`Vault API response slow: ${connectMs}ms`);
    }

    healthScore = Math.max(0, healthScore);

    const healthStatus = healthScore >= 80 ? 'healthy' :
                         healthScore >= 50 ? 'degraded' : 'critical';

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      health: {
        source: 'Vault eTMF',
        overall: healthStatus,
        healthScore,
        vault: {
          connected: true,
          responseTimeMs: connectMs,
          totalDocuments: totalDocs,
        },
        activity: {
          last24Hours: last24h,
          last7Days: last7d,
        },
        inbox: {
          unclassified,
          staleItems: staleInbox,
          inQcReview: inQc,
        },
        statusBreakdown,
        issues: issues.length > 0 ? issues : ['No issues detected'],
        qualityTargets: {
          filingTimeliness: '90%',
          deficiencyFree: '95%',
          incompleteThreshold: '<10%',
        },
      },
    });
  } catch (e) {
    res.status(200).json({
      status: 'error',
      generatedAt: new Date().toISOString(),
      health: {
        source: 'Vault eTMF',
        overall: 'critical',
        healthScore: 0,
        vault: {
          connected: false,
          error: String(e.message || e),
        },
        activity: { last24Hours: 0, last7Days: 0 },
        inbox: { unclassified: 0, staleItems: 0, inQcReview: 0 },
        statusBreakdown: {},
        issues: [`Vault connection failed: ${e.message || e}`],
      },
    });
  }
}
