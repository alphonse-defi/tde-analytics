// ============================================
// NANSEN API SERVICE - Phase 5
// All endpoints are POST with JSON bodies
// Docs: https://docs.nansen.ai/api
// ============================================

const NANSEN_CACHE = new Map();
const NANSEN_CACHE_TTL = 5 * 60 * 1000; // 5 min

// Chain mapping: our keys → Nansen chain names
const CHAIN_MAP = {
  'eth': 'ethereum',
  'arbitrum': 'arbitrum',
  'base': 'base',
  'polygon': 'polygon',
  'bsc': 'bnb',
  'solana': 'solana'
};

function nansenChain(chain) {
  return CHAIN_MAP[chain] || chain;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ============================================
// CORE FETCH — POST to /api/nansen proxy
// ============================================

async function fetchNansen(endpoint, body, signal) {
  const cacheKey = endpoint + JSON.stringify(body);
  const cached = NANSEN_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < NANSEN_CACHE_TTL)) {
    return cached.data;
  }

  // Client-side timeout: 12s (slightly above the 8s server timeout)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  // Combine external signal with our timeout signal
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  let response;
  try {
    response = await fetch('/api/nansen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, body }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('NANSEN_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorCode = errorData.error || `Nansen API error: ${response.status}`;
    throw new Error(errorCode);
  }

  const data = await response.json();
  NANSEN_CACHE.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// ============================================
// TGM HOLDERS — POST /tgm/holders (5 credits)
// Returns: { data: [...], pagination: {...} }
// ============================================

export async function getTokenHolders(tokenAddress, chain = 'eth', options = {}, signal) {
  const { page = 1, perPage = 100, labelType = 'all_holders' } = options;

  const body = {
    chain: nansenChain(chain),
    token_address: tokenAddress,
    aggregate_by_entity: false,
    label_type: labelType,
    pagination: { page, per_page: perPage },
    order_by: [{ field: 'value_usd', direction: 'DESC' }]
  };

  // Add smart money label filter if requesting smart money
  if (labelType === 'smart_money') {
    body.filters = {
      include_smart_money_labels: ['Fund', '30D Smart Trader', '90D Smart Trader', 'Smart Trader']
    };
  }

  const result = await fetchNansen('/tgm/holders', body, signal);

  // Normalize response to our internal holder format
  return (result.data || []).map(h => ({
    owner_address: h.address,
    balance: String(h.token_amount || 0),
    balance_formatted: String(h.token_amount || 0),
    percentage_relative_to_total_supply: h.ownership_percentage || 0,
    usd_value: h.value_usd || 0,
    // Nansen-specific fields
    entity_name: h.address_label || null,
    entity_type: h.address_label ? classifyLabel(h.address_label) : null,
    smart_money: isSmartMoney(h.address_label),
    labels: h.address_label ? [h.address_label] : [],
    // Balance changes
    balance_change_24h: h.balance_change_24h || null,
    balance_change_7d: h.balance_change_7d || null,
    balance_change_30d: h.balance_change_30d || null,
    // Flow data
    total_inflow: h.total_inflow || 0,
    total_outflow: h.total_outflow || 0,
    chain: chain,
    is_contract: false
  }));
}

// ============================================
// TGM FLOWS — POST /tgm/flows (5 credits)
// Returns: { data: [...], pagination: {...} }
// Shows daily inflow/outflow by label type
// ============================================

export async function getTokenFlows(tokenAddress, chain = 'eth', options = {}, signal) {
  const { label = 'smart_money', days = 7 } = options;

  const body = {
    chain: nansenChain(chain),
    token_address: tokenAddress,
    date: {
      from: daysAgoISO(days),
      to: todayISO()
    },
    label: label,
    pagination: { page: 1, per_page: 100 },
    order_by: [{ field: 'date', direction: 'ASC' }]
  };

  const result = await fetchNansen('/tgm/flows', body, signal);

  return (result.data || []).map(row => ({
    date: row.date,
    price_usd: row.price_usd || 0,
    token_amount: row.token_amount || 0,
    value_usd: row.value_usd || 0,
    holders_count: row.holders_count || 0,
    total_inflows: row.total_inflows_count || 0,
    total_outflows: row.total_outflows_count || 0
  }));
}

// ============================================
// SMART MONEY HOLDINGS — POST /smart-money/holdings (5 credits)
// Aggregated SM balances across chains, filtered by token
// ============================================

export async function getSmartMoneyHoldings(chains = ['ethereum'], signal) {
  const body = {
    chains: chains.map(c => nansenChain(c)),
    filters: {
      include_smart_money_labels: ['Fund', 'Smart Trader', '30D Smart Trader', '90D Smart Trader'],
      include_stablecoins: false,
      include_native_tokens: false
    },
    pagination: { page: 1, per_page: 50 },
    order_by: [{ field: 'value_usd', direction: 'DESC' }]
  };

  const result = await fetchNansen('/smart-money/holdings', body, signal);
  return result.data || [];
}

// ============================================
// SMART MONEY DEX TRADES — POST /smart-money/dex-trades (5 credits)
// Recent 24h SM trades
// ============================================

export async function getSmartMoneyDexTrades(chains = ['ethereum'], signal) {
  const body = {
    chains: chains.map(c => nansenChain(c)),
    smFilter: ['Fund', 'Smart Trader', '30D Smart Trader'],
    excludeSmFilter: [],
    pagination: { page: 1, per_page: 50 }
  };

  const result = await fetchNansen('/smart-money/dex-trades', body, signal);
  return result.data || [];
}

// ============================================
// TGM DEX TRADES — POST /tgm/dex-trades (1 credit, requires attribution)
// Token-specific DEX trades with optional SM filter
// ============================================

export async function getTokenDexTrades(tokenAddress, chain = 'eth', options = {}, signal) {
  const { onlySmartMoney = false, days = 1 } = options;

  const body = {
    chain: nansenChain(chain),
    token_address: tokenAddress,
    only_smart_money: onlySmartMoney,
    date: {
      from: daysAgoISO(days),
      to: todayISO()
    },
    pagination: { page: 1, per_page: 100 }
  };

  // Note: field name may be 'onlySmartMoney' in beta vs v1, handle both
  const result = await fetchNansen('/tgm/dex-trades', body, signal);
  return result.data || [];
}

// ============================================
// TGM WHO BOUGHT/SOLD — undocumented in v1, use flows + holders instead
// We derive this from flows data comparing label types
// ============================================

export async function getWhoBoughtSold(tokenAddress, chain = 'eth', options = {}, signal) {
  const { days = 1 } = options;

  // Fetch flows for multiple label types in parallel
  const [smFlows, whaleFlows, exchangeFlows] = await Promise.all([
    getTokenFlows(tokenAddress, chain, { label: 'smart_money', days }, signal).catch(() => []),
    getTokenFlows(tokenAddress, chain, { label: 'whale', days }, signal).catch(() => []),
    getTokenFlows(tokenAddress, chain, { label: 'exchange', days }, signal).catch(() => [])
  ]);

  // Aggregate flows to derive who is buying vs selling
  const aggregate = (flows, entityType) => {
    const totalInflows = flows.reduce((sum, f) => sum + (f.total_inflows || 0), 0);
    const totalOutflows = flows.reduce((sum, f) => sum + (f.total_outflows || 0), 0);
    const latestValue = flows.length > 0 ? flows[flows.length - 1].value_usd : 0;
    const latestHolders = flows.length > 0 ? flows[flows.length - 1].holders_count : 0;
    return {
      entity_type: entityType,
      entity_name: entityType.charAt(0).toUpperCase() + entityType.slice(1).replace('_', ' '),
      total_inflows: totalInflows,
      total_outflows: totalOutflows,
      net_flow: totalInflows - totalOutflows,
      value_usd: latestValue,
      holders_count: latestHolders,
      is_net_buyer: totalInflows > totalOutflows
    };
  };

  const entities = [
    aggregate(smFlows, 'smart_money'),
    aggregate(whaleFlows, 'whale'),
    aggregate(exchangeFlows, 'exchange')
  ];

  const buyers = entities.filter(e => e.is_net_buyer).sort((a, b) => b.net_flow - a.net_flow);
  const sellers = entities.filter(e => !e.is_net_buyer).sort((a, b) => a.net_flow - b.net_flow);

  const netFlow = entities.reduce((sum, e) => sum + e.net_flow, 0);

  return { buyers, sellers, net_flow: netFlow, flows: { smFlows, whaleFlows, exchangeFlows } };
}

// ============================================
// GINI COEFFICIENT CALCULATION
// ============================================

export function calculateGini(holders) {
  if (!holders || holders.length < 2) return 0;

  const balances = holders
    .map(h => parseFloat(h.balance_formatted || h.balance) || 0)
    .filter(b => b > 0)
    .sort((a, b) => a - b);

  if (balances.length < 2) return 0;

  const n = balances.length;
  const sum = balances.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * balances[i];
  }

  return Math.max(0, Math.min(1, numerator / (n * sum)));
}

// ============================================
// LABEL CLASSIFICATION HELPERS
// ============================================

function classifyLabel(label) {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes('fund')) return 'fund';
  if (l.includes('smart') || l.includes('trader')) return 'smart_trader';
  if (l.includes('exchange')) return 'exchange';
  if (l.includes('whale')) return 'whale';
  if (l.includes('dao') || l.includes('governance')) return 'dao';
  if (l.includes('public') || l.includes('influencer')) return 'public_figure';
  return 'labeled';
}

function isSmartMoney(label) {
  if (!label) return false;
  const l = label.toLowerCase();
  return l.includes('smart') || l.includes('fund') || l.includes('trader');
}

// ============================================
// AVAILABILITY CHECK
// ============================================

export async function checkNansenAvailability() {
  try {
    // Try a minimal holdings request to check auth
    const response = await fetch('/api/nansen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/smart-money/holdings',
        body: {
          chains: ['ethereum'],
          pagination: { page: 1, per_page: 1 },
          filters: { include_smart_money_labels: ['Fund'] }
        }
      })
    });

    if (response.status === 500) {
      const data = await response.json().catch(() => ({}));
      if (data.error === 'NANSEN_NOT_CONFIGURED') {
        return { available: false, reason: 'API key not configured' };
      }
    }
    if (response.status === 401 || response.status === 403) {
      return { available: false, reason: 'Invalid API key' };
    }
    return { available: response.ok, reason: response.ok ? null : `HTTP ${response.status}` };
  } catch {
    return { available: false, reason: 'Network error' };
  }
}

export function clearNansenCache() {
  NANSEN_CACHE.clear();
}
