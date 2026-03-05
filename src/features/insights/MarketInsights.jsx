import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { THEME } from '../../utils/theme.js';
import { formatLargeUSD, formatPercent } from '../../utils/formatters.js';
import { COINGECKO_PLATFORM_MAP } from '../../utils/constants.js';
import { LoadingSpinner } from '../../components/shared.jsx';
import { fetchFromCoinGecko, getCoinGeckoDetail } from '../../services/api.js';
import { getSmartMoneyHoldings } from '../../services/nansen.js';

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

// Known stablecoins, L1s, L2s for filtering
const STABLECOINS = new Set(['usdt', 'usdc', 'dai', 'busd', 'tusd', 'frax', 'lusd', 'usdd', 'gusd', 'pyusd', 'fdusd', 'usdp', 'susd', 'eur', 'euroc', 'eurt', 'gho', 'cusd', 'dola', 'usde', 'susde', 'fxusd', 'mkusd', 'crvusd']);
const L1_TOKENS = new Set(['btc', 'eth', 'sol', 'ada', 'avax', 'dot', 'atom', 'near', 'apt', 'sui', 'sei', 'ton', 'trx', 'bnb', 'xlm', 'algo', 'xtz', 'icp', 'hbar', 'egld', 'kas', 'ftm', 'vet', 'neo', 'xrp', 'ltc', 'bch', 'etc', 'xmr', 'zec', 'doge', 'shib']);
const L2_TOKENS = new Set(['arb', 'op', 'matic', 'pol', 'mnt', 'metis', 'strk', 'zk', 'imx', 'skl', 'boba', 'lrc']);

function tokenCategory(symbol) {
  const s = (symbol || '').toLowerCase();
  if (STABLECOINS.has(s)) return 'stablecoin';
  if (L1_TOKENS.has(s)) return 'l1';
  if (L2_TOKENS.has(s)) return 'l2';
  return 'other';
}

// Severity config
const SEV = {
  critical: { bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.2)', color: '#dc2626', dot: '#dc2626' },
  warning: { bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.2)', color: '#d97706', dot: '#d97706' },
  positive: { bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.2)', color: '#16a34a', dot: '#16a34a' },
  info: { bg: 'rgba(37, 99, 235, 0.06)', border: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', dot: '#2563eb' }
};

// ============================================
// SIGNAL CARD
// ============================================

const SignalCard = memo(({ severity, icon, title, message, metric }) => {
  const s = SEV[severity] || SEV.info;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: '8px',
      padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px',
      transition: 'transform 0.15s ease'
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: THEME.text.primary }}>{title}</span>
          {metric && (
            <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {metric}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: THEME.text.secondary, lineHeight: 1.4 }}>{message}</div>
      </div>
    </div>
  );
});
SignalCard.displayName = 'SignalCard';

// ============================================
// FLOW TOKEN ROW
// ============================================

const FlowTokenRow = memo(({ token, type, rank, onSelect }) => {
  const change = token.price_change_percentage_24h || 0;
  const isUp = change >= 0;
  return (
    <div onClick={() => onSelect && onSelect(token)} style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px', background: THEME.bg.secondary, borderRadius: '6px',
      border: `1px solid ${THEME.border.default}`,
      cursor: onSelect ? 'pointer' : 'default', transition: 'background 0.15s ease'
    }}
      onMouseEnter={e => onSelect && (e.currentTarget.style.background = THEME.bg.hover)}
      onMouseLeave={e => e.currentTarget.style.background = THEME.bg.secondary}
    >
      <span style={{
        width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: type === 'inflow' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
        color: type === 'inflow' ? THEME.accent.success : THEME.accent.error,
        fontSize: '0.65rem', fontWeight: '700'
      }}>{rank}</span>
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: THEME.bg.tertiary, overflow: 'hidden', flexShrink: 0 }}>
        {token.image && <img src={token.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '0.8rem', color: THEME.text.primary, textTransform: 'uppercase' }}>{token.symbol}</div>
        <div style={{ fontSize: '0.65rem', color: THEME.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: THEME.text.primary }}>{formatLargeUSD(token.current_price)}</div>
        <div style={{ fontSize: '0.7rem', fontWeight: '600', color: isUp ? THEME.accent.success : THEME.accent.error }}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: '70px' }}>
        <div style={{ fontSize: '0.7rem', color: THEME.text.muted }}>Vol 24h</div>
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: THEME.text.primary }}>{formatLargeUSD(token.total_volume)}</div>
      </div>
    </div>
  );
});
FlowTokenRow.displayName = 'FlowTokenRow';

// ============================================
// FILTER PILL
// ============================================

const FilterPill = memo(({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '4px 12px', borderRadius: '20px',
    background: active ? THEME.accent.primary : THEME.bg.secondary,
    border: `1px solid ${active ? THEME.accent.primary : THEME.border.default}`,
    color: active ? '#fff' : THEME.text.secondary,
    fontSize: '0.7rem', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s'
  }}>{label}</button>
));
FilterPill.displayName = 'FilterPill';

// ============================================
// MAIN COMPONENT
// ============================================

const MarketInsights = memo(({ onSelectToken, trackedTokens }) => {
  const [marketData, setMarketData] = useState([]);
  const [smHoldings, setSmHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showAllSignals, setShowAllSignals] = useState(false);

  // Filters: which categories to EXCLUDE
  const [excludeL1, setExcludeL1] = useState(false);
  const [excludeL2, setExcludeL2] = useState(false);
  const [excludeStable, setExcludeStable] = useState(true); // stablecoins excluded by default

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [market, sm] = await Promise.all([
        fetchFromCoinGecko('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d').catch(() => []),
        getSmartMoneyHoldings(['ethereum', 'base', 'arbitrum', 'solana']).catch(() => [])
      ]);
      setMarketData(market || []);
      setSmHoldings(sm || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Market insights load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // Filter market data based on selected filters
  const filteredMarket = useMemo(() => {
    return marketData.filter(t => {
      const cat = tokenCategory(t.symbol);
      if (excludeStable && cat === 'stablecoin') return false;
      if (excludeL1 && cat === 'l1') return false;
      if (excludeL2 && cat === 'l2') return false;
      return true;
    });
  }, [marketData, excludeL1, excludeL2, excludeStable]);

  // Top 5 inflow/outflow from filtered data
  const { topInflow, topOutflow } = useMemo(() => {
    if (filteredMarket.length === 0) return { topInflow: [], topOutflow: [] };
    const withVolume = filteredMarket.filter(t => (t.total_volume || 0) > 100000);
    const inflow = [...withVolume].filter(t => (t.price_change_percentage_24h || 0) > 0)
      .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0)).slice(0, 5);
    const outflow = [...withVolume].filter(t => (t.price_change_percentage_24h || 0) < 0)
      .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0)).slice(0, 5);
    return { topInflow: inflow, topOutflow: outflow };
  }, [filteredMarket]);

  // Signals — SM consensus and sentiment first, then others
  const signals = useMemo(() => {
    const priority = []; // SM consensus + sentiment (shown first)
    const secondary = []; // volume spikes, momentum, SM accumulation

    // Exclude stablecoins from all signal detection
    const nonStable = marketData.filter(t => tokenCategory(t.symbol) !== 'stablecoin');

    // --- PRIORITY: SM consensus ---
    if (smHoldings.length > 0) {
      const tokenSmCount = {};
      smHoldings.forEach(h => {
        const sym = (h.token_symbol || h.symbol || '').toUpperCase();
        if (sym && tokenCategory(sym) !== 'stablecoin') {
          tokenSmCount[sym] = (tokenSmCount[sym] || 0) + 1;
        }
      });
      Object.entries(tokenSmCount)
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([sym, count]) => {
          priority.push({
            severity: 'positive', icon: '🧠',
            title: `SM consensus: ${sym}`,
            message: `${count} Smart Money wallets/funds are holding ${sym} — multi-entity convergence signal.`,
            metric: `${count} SM wallets`
          });
        });
    }

    // --- PRIORITY: Market sentiment shift ---
    if (nonStable.length >= 50) {
      const top100 = nonStable.slice(0, 100);
      const greenCount = top100.filter(t => (t.price_change_percentage_24h || 0) > 0).length;
      const redCount = top100.length - greenCount;
      const greenPct = Math.round((greenCount / top100.length) * 100);
      const redPct = 100 - greenPct;

      if (greenPct >= 75) {
        priority.push({ severity: 'positive', icon: '🟢', title: 'Broad market rally', message: `${greenPct}% of top tokens are positive in 24h — broad-based buying across the market.`, metric: `${greenPct}% green` });
      } else if (redPct >= 75) {
        priority.push({ severity: 'critical', icon: '🔴', title: 'Broad market selloff', message: `${redPct}% of top tokens are negative in 24h — widespread selling pressure.`, metric: `${redPct}% red` });
      } else if (greenPct >= 60) {
        priority.push({ severity: 'info', icon: '📈', title: 'Market leaning bullish', message: `${greenPct}% of top tokens are positive. Sentiment is cautiously bullish.`, metric: `${greenPct}% green` });
      } else if (redPct >= 60) {
        priority.push({ severity: 'warning', icon: '📉', title: 'Market leaning bearish', message: `${redPct}% of top tokens are negative. Sentiment is cautiously bearish.`, metric: `${redPct}% red` });
      }
    }

    // --- SECONDARY: Volume spikes ---
    const volumeRatios = nonStable
      .filter(t => t.market_cap > 1000000 && t.total_volume > 0)
      .map(t => ({ ...t, volRatio: t.total_volume / t.market_cap }))
      .sort((a, b) => b.volRatio - a.volRatio);
    const medianVolRatio = volumeRatios.length > 10 ? volumeRatios[Math.floor(volumeRatios.length / 2)].volRatio : 0.05;

    volumeRatios.filter(t => t.volRatio > medianVolRatio * 3 && t.market_cap > 10000000).slice(0, 3).forEach(t => {
      secondary.push({
        severity: 'warning', icon: '📊',
        title: `Volume spike: ${t.symbol?.toUpperCase()}`,
        message: `24h volume is ${(t.volRatio * 100).toFixed(1)}% of market cap (${(t.volRatio / medianVolRatio).toFixed(1)}x median). Price ${(t.price_change_percentage_24h || 0) >= 0 ? 'up' : 'down'} ${Math.abs(t.price_change_percentage_24h || 0).toFixed(1)}%.`,
        metric: `${(t.volRatio / medianVolRatio).toFixed(1)}x vol`
      });
    });

    // --- SECONDARY: SM accumulation spikes ---
    if (smHoldings.length > 0) {
      smHoldings
        .filter(h => (h.holders_count || 0) > 5 && (h.balance_24h_percent_change || 0) > 10 && tokenCategory(h.token_symbol || h.symbol || '') !== 'stablecoin')
        .slice(0, 3)
        .forEach(h => {
          const sym = (h.token_symbol || h.symbol || 'Unknown').toUpperCase();
          secondary.push({
            severity: 'positive', icon: '📤',
            title: `SM accumulation: ${sym}`,
            message: `Smart Money positions increased ${(h.balance_24h_percent_change || 0).toFixed(1)}% in 24h across ${h.holders_count || 0} wallets.`,
            metric: `+${(h.balance_24h_percent_change || 0).toFixed(1)}%`
          });
        });
    }

    // --- SECONDARY: Mid-cap momentum ---
    nonStable
      .filter(t => t.market_cap > 5000000 && t.market_cap < 500000000 && (t.price_change_percentage_24h || 0) > 10)
      .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
      .slice(0, 3)
      .forEach(t => {
        secondary.push({
          severity: 'info', icon: '🆕',
          title: `Momentum: ${t.symbol?.toUpperCase()}`,
          message: `${t.name} is up ${(t.price_change_percentage_24h || 0).toFixed(1)}% with ${formatLargeUSD(t.total_volume)} volume.`,
          metric: `+${(t.price_change_percentage_24h || 0).toFixed(1)}%`
        });
      });

    return { priority, secondary, all: [...priority, ...secondary] };
  }, [marketData, smHoldings]);

  // Chain-agnostic token selection — fetch CoinGecko detail to find correct chain
  const handleSelectFlowToken = useCallback(async (token) => {
    if (!onSelectToken) return;
    try {
      const cgData = await getCoinGeckoDetail(token.id);
      let contractAddress = null;
      let chain = 'eth';
      if (cgData?.platforms) {
        for (const [platform, address] of Object.entries(cgData.platforms)) {
          if (address && COINGECKO_PLATFORM_MAP[platform]) {
            contractAddress = address;
            chain = COINGECKO_PLATFORM_MAP[platform];
            break;
          }
        }
      }
      onSelectToken({
        address: contractAddress || token.id,
        symbol: token.symbol?.toUpperCase(),
        name: token.name,
        chain,
        logo: token.image || '🪙',
        coingeckoId: token.id,
        hasContractAddress: !!contractAddress
      });
    } catch {
      onSelectToken({
        address: token.id, symbol: token.symbol?.toUpperCase(), name: token.name,
        chain: 'eth', logo: token.image || '🪙', coingeckoId: token.id, hasContractAddress: false
      });
    }
  }, [onSelectToken]);

  const displayedSignals = showAllSignals ? signals.all : signals.priority;
  const hasMoreSignals = signals.secondary.length > 0 && !showAllSignals;

  if (loading && marketData.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px', background: THEME.bg.secondary, borderRadius: '8px', border: `1px solid ${THEME.border.default}` }}>
        <LoadingSpinner size={24} />
        <span style={{ marginLeft: '12px', color: THEME.text.secondary }}>Loading market insights...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.125rem', fontWeight: '600', color: THEME.text.primary }}>Market Radar</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: THEME.text.muted }}>Smart Money signals and anomalies across the market</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRefresh && <span style={{ fontSize: '0.65rem', color: THEME.text.muted }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={loadData} disabled={loading} style={{
            padding: '6px 14px', background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`,
            borderRadius: '6px', color: THEME.text.secondary, fontSize: '0.75rem', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {loading && <LoadingSpinner size={12} />}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: THEME.text.muted, marginRight: '4px' }}>Exclude:</span>
        <FilterPill label="Stablecoins" active={excludeStable} onClick={() => setExcludeStable(!excludeStable)} />
        <FilterPill label="L1 Tokens" active={excludeL1} onClick={() => setExcludeL1(!excludeL1)} />
        <FilterPill label="L2 Tokens" active={excludeL2} onClick={() => setExcludeL2(!excludeL2)} />
      </div>

      {/* Priority Signals */}
      {displayedSignals.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>
              {showAllSignals ? 'All Signals' : 'Top Signals'}
            </h3>
            <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>{displayedSignals.length} detected</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayedSignals.map((sig, i) => <SignalCard key={i} {...sig} />)}
          </div>
          {/* Expand / collapse */}
          {(hasMoreSignals || showAllSignals) && (
            <button onClick={() => setShowAllSignals(!showAllSignals)} style={{
              display: 'block', width: '100%', marginTop: '10px', padding: '10px',
              background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`,
              borderRadius: '6px', color: THEME.accent.primary, fontSize: '0.8rem', fontWeight: '500',
              cursor: 'pointer', textAlign: 'center'
            }}>
              {showAllSignals
                ? 'Show top signals only'
                : `View ${signals.secondary.length} more signals`}
            </button>
          )}
        </div>
      )}

      {/* Top Flows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>Top Inflows</h3>
            <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>Highest volume gainers</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topInflow.length > 0 ? topInflow.map((t, i) => (
              <FlowTokenRow key={t.id} token={t} type="inflow" rank={i + 1} onSelect={handleSelectFlowToken} />
            )) : <div style={{ padding: '20px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.8rem' }}>No data</div>}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>Top Outflows</h3>
            <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>Highest volume losers</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topOutflow.length > 0 ? topOutflow.map((t, i) => (
              <FlowTokenRow key={t.id} token={t} type="outflow" rank={i + 1} onSelect={handleSelectFlowToken} />
            )) : <div style={{ padding: '20px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.8rem' }}>No data</div>}
          </div>
        </div>
      </div>

      {/* Search prompt */}
      <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px 0', color: THEME.text.secondary, fontSize: '0.8rem' }}>
          Search for a token above or click any token in the flow lists to analyze it.
        </p>
      </div>
    </div>
  );
});

MarketInsights.displayName = 'MarketInsights';
export default MarketInsights;
