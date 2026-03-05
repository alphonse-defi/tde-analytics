// Nansen API proxy - Phase 5: Smart Money Tracking
// All Nansen V1 endpoints use POST with JSON bodies
// Auth: apiKey header | Base: https://api.nansen.ai/api/v1

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Nansen API requires POST.' });
  }

  const nansenApiKey = process.env.NANSEN_API_KEY;
  if (!nansenApiKey) {
    return res.status(500).json({ error: 'NANSEN_NOT_CONFIGURED' });
  }

  // The client sends { endpoint, body } in the POST payload
  const { endpoint, body } = req.body || {};

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint in request body' });
  }

  try {
    const apiUrl = `https://api.nansen.ai/api/v1${endpoint}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apiKey': nansenApiKey
      },
      body: JSON.stringify(body || {})
    });

    // Rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      return res.status(429).json({
        error: 'NANSEN_RATE_LIMITED',
        retryAfter: parseInt(retryAfter)
      });
    }

    // Credit exhaustion
    if (response.status === 402) {
      return res.status(402).json({ error: 'NANSEN_CREDITS_EXHAUSTED' });
    }

    // Auth errors
    if (response.status === 401 || response.status === 403) {
      return res.status(response.status).json({ error: 'NANSEN_AUTH_FAILED' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Nansen API ${response.status} from ${endpoint}:`, errorText);
      return res.status(response.status).json({
        error: `Nansen API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Cache based on endpoint type
    let cacheDuration = 300;
    if (endpoint.includes('/smart-money/')) cacheDuration = 600;
    else if (endpoint.includes('/flows')) cacheDuration = 300;
    else if (endpoint.includes('/holders')) cacheDuration = 300;
    else if (endpoint.includes('/dex-trades')) cacheDuration = 120;

    res.setHeader('Cache-Control', `s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`);

    // Pass through Nansen credit usage headers if present
    const creditsRemaining = response.headers.get('x-credits-remaining');
    if (creditsRemaining) {
      res.setHeader('X-Nansen-Credits-Remaining', creditsRemaining);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Nansen proxy error:', error);
    return res.status(500).json({
      error: 'Failed to reach Nansen API',
      details: error.message
    });
  }
}
