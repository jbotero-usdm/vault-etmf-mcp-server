export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'Box webhook endpoint is reachable' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    console.log('BOX_WEBHOOK_EVENT', JSON.stringify(body));

    // Future path:
    // 1. validate signatures if required by your Box setup
    // 2. trigger dashboard cache refresh or workflow processing
    // 3. enqueue classification/QC logic

    return res.status(200).json({
      status: 'accepted',
      receivedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
