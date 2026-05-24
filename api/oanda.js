const OANDA_BASE = 'https://api-fxpractice.oanda.com/v3';
const OANDA_TOKEN = process.env.OANDA_TOKEN;
const OANDA_ACCOUNT = process.env.OANDA_ACCOUNT;

export default async function handler(req, res) {
  // Allow CORS from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint } = req.query;

  // Whitelist allowed endpoints
  const allowed = ['account', 'summary', 'positions', 'transactions'];
  if (!endpoint || !allowed.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  const urlMap = {
    account:      `${OANDA_BASE}/accounts/${OANDA_ACCOUNT}`,
    summary:      `${OANDA_BASE}/accounts/${OANDA_ACCOUNT}/summary`,
    positions:    `${OANDA_BASE}/accounts/${OANDA_ACCOUNT}/openPositions`,
    transactions: `${OANDA_BASE}/accounts/${OANDA_ACCOUNT}/transactions?count=20`,
  };

  try {
    const oandaRes = await fetch(urlMap[endpoint], {
      headers: {
        'Authorization': `Bearer ${OANDA_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await oandaRes.json();
    return res.status(oandaRes.status).json(data);

  } catch (err) {
    console.error('Oanda proxy error:', err);
    return res.status(500).json({ error: 'Oanda request failed' });
  }
}