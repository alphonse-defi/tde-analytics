import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { THEME } from '../../utils/theme.js';
import { formatLargeUSD, formatPercent } from '../../utils/formatters.js';
import { LoadingSpinner } from '../../components/shared.jsx';
import { fetchFromCoinGecko } from '../../services/api.js';
import { getSmartMoneyHoldings } from '../../services/nansen.js';

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

// ============================================
// SEVERITY CONFIG (shared with InsightsFeed)
// ============================================

const SEV = {
  critical: { bg: 'rgba(248, 81, 73, 0.12)', border: 'rgba(248, 81, 73, 0.3)', color: '#f85149', dot: '#f85149' },
  warning: { bg: 'rgba(210, 153, 34, 0.12)', border: 'rgba(210, 153, 34, 0.3)', color: '#d29922', dot: '#d29922' },
  positive: { bg: 'rgba(63, 185, 80, 0.12)', border: 'rgba(63, 185, 80, 0.3)', color: '#3fb950', dot: '#3fb950' },
  info: { bg: 'rgba(88, 166, 255, 0.08)', border: 'rgba(88, 166, 255, 0.2)', color: '#58a6ff', dot: '#58a6ff' }
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
    <div
      onClick={() => onSelect && onSelect(token)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px', background: THEME.bg.tertiary, borderRadius: '6px',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background 0.15s ease'
      }}
      onMouseEnter={e => onSelect && (e.currentTarget.style.background = THEME.bg.hover)}
      onMouseLeave={e => e.currentTarget.style.background = THEME.bg.tertiary}
    >
      <span style={{
        width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: type === 'inflow' ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)',
        color: type === 'inflow' ? THEME.accent.success : THEME.accent.error,
        fontSize: '0.65rem', fontWeight: '700'
      }}>
        {rank}
      </span>

      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0 }}>
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
// SECTION WRAPPER
// ============================================

const Section = memo(({ title, subtitle, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>{title}</h3>
      {subtitle && <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>{subtitle}</span>}
    </div>
    {children}
  </div>
));
Section.displayName = 'Section';

// ============================================
// MAIN COMPONENT
// ============================================

const MarketInsights = memo(({ onSelectToken, trackedTokens }) => {
  const [marketData, setMarketData] = useState([]);
  const [smHoldings, setSmHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [market, sm] = await Promise.all([
        fetchFromCoinGecko('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d')
          .catch(() => []),
        getSmartMoneyHoldings(['ethereum', 'base', 'arbitrum', 'solana'])
          .catch(() => [])
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

  // ---- DERIVED INSIGHTS ----

  // Top 5 inflow (gainers with high volume) / outflow (losers with high volume)
  const { topInflow, topOutflow } = useMemo(() => {
    if (marketData.length === 0) return { topInflow: [], topOutflow: [] };
    const withVolume = marketData.filter(t => (t.total_volume || 0) > 100000);
    const inflow = [...withVolume]
      .filter(t => (t.price_change_percentage_24h || 0) > 0)
      .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0))
      .slice(0, 5);
    const outflow = [...withVolume]
      .filter(t => (t.price_change_percentage_24h || 0) < 0)
      .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0))
      .slice(0, 5);
    return { topInflow: inflow, topOutflow: outflow };
  }, [marketData]);

  // Market signals
  const signals = useMemo(() => {
    const s = [];
    if (marketData.length === 0) return s;

    // 1. Volume spike detection (>3x implied average via volume/mcap ratio outliers)
    const volumeRatios = marketData
      .filter(t => t.market_cap > 1000000 && t.total_volume > 0)
      .map(t => ({ ...t, volRatio: t.total_volume / t.market_cap }))
      .sort((a, b) => b.volRatio - a.volRatio);

    const medianVolRatio = volumeRatios.length > 10
      ? volumeRatios[Math.floor(volumeRatios.length / 2)].volRatio
      : 0.05;

    const spikes = volumeRatios.filter(t => t.volRatio > medianVolRatio * 3 && t.market_cap > 10000000).slice(0, 3);
    spikes.forEach(t => {
      s.push({
        severity: 'warning', icon: '📊',
        title: `Volume spike: ${t.symbol?.toUpperCase()}`,
        message: `24h volume is ${(t.volRatio * 100).toFixed(1)}% of market cap (${(t.volRatio / medianVolRatio).toFixed(1)}x the median ratio). Price ${(t.price_change_percentage_24h || 0) >= 0 ? 'up' : 'down'} ${Math.abs(t.price_change_percentage_24h || 0).toFixed(1)}%.`,
        metric: `${(t.volRatio / medianVolRatio).toFixed(1)}x vol`
      });
    });

    // 2. Market sentiment shift — what % of top 100 are green vs red
    const top100 = marketData.slice(0, 100);
    const greenCount = top100.filter(t => (t.price_change_percentage_24h || 0) > 0).length;
    const redCount = 100 - greenCount;

    if (greenCount >= 75) {
      s.push({
        severity: 'positive', icon: '🟢',
        title: 'Broad market rally',
        message: `${greenCount}% of top 100 tokens are positive in 24h — broad-based buying across the market.`,
        metric: `${greenCount}% green`
      });
    } else if (redCount >= 75) {
      s.push({
        severity: 'critical', icon: '🔴',
        title: 'Broad market selloff',
        message: `${redCount}% of top 100 tokens are negative in 24h — widespread selling pressure.`,
        metric: `${redCount}% red`
      });
    } else if (greenCount >= 60) {
      s.push({
        severity: 'info', icon: '📈',
        title: 'Market leaning bullish',
        message: `${greenCount}% of top 100 tokens are positive. Sentiment is cautiously bullish.`,
        metric: `${greenCount}% green`
      });
    } else if (redCount >= 60) {
      s.push({
        severity: 'warning', icon: '📉',
        title: 'Market leaning bearish',
        message: `${redCount}% of top 100 tokens are negative. Sentiment is cautiously bearish.`,
        metric: `${redCount}% red`
      });
    }

    // 3. SM consensus — from Nansen holdings
    if (smHoldings.length > 0) {
      // Count how many SM entries each token has (multiple SM wallets holding same token)
      const tokenSmCount = {};
      smHoldings.forEach(h => {
        const sym = (h.token_symbol || h.symbol || '').toUpperCase();
        if (sym && sym !== 'ETH' && sym !== 'WETH' && sym !== 'USDC' && sym !== 'USDT' && sym !== 'DAI') {
          tokenSmCount[sym] = (tokenSmCount[sym] || 0) + 1;
        }
      });
      const consensus = Object.entries(tokenSmCount)
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      consensus.forEach(([sym, count]) => {
        s.push({
          severity: 'positive', icon: '🧠',
          title: `SM consensus: ${sym}`,
          message: `${count} Smart Money wallets/funds are holding ${sym} — multi-entity convergence signal.`,
          metric: `${count} SM wallets`
        });
      });

      // 4. Exchange outflow proxy — look for SM accumulation tokens with high holder counts
      const bigSmPositions = smHoldings
        .filter(h => (h.holders_count || 0) > 5 && (h.balance_24h_percent_change || 0) > 10)
        .slice(0, 2);
      bigSmPositions.forEach(h => {
        const sym = (h.token_symbol || h.symbol || 'Unknown').toUpperCase();
        s.push({
          severity: 'positive', icon: '📤',
          title: `SM accumulation spike: ${sym}`,
          message: `Smart Money positions in ${sym} increased ${(h.balance_24h_percent_change || 0).toFixed(1)}% in 24h across ${h.holders_count || 0} wallets.`,
          metric: `+${(h.balance_24h_percent_change || 0).toFixed(1)}%`
        });
      });
    }

    // 5. Fresh wallet inflow proxy — tokens with outsized price moves on low mcap
    const freshSignals = marketData
      .filter(t => t.market_cap > 5000000 && t.market_cap < 500000000)
      .filter(t => (t.price_change_percentage_24h || 0) > 10)
      .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
      .slice(0, 2);

    freshSignals.forEach(t => {
      s.push({
        severity: 'info', icon: '🆕',
        title: `Momentum: ${t.symbol?.toUpperCase()}`,
        message: `${t.name} is up ${(t.price_change_percentage_24h || 0).toFixed(1)}% with ${formatLargeUSD(t.total_volume)} volume — mid-cap with strong inflow activity.`,
        metric: `+${(t.price_change_percentage_24h || 0).toFixed(1)}%`
      });
    });

    return s;
  }, [marketData, smHoldings]);

  // Handle clicking a token in the flow list
  const handleSelectFlowToken = useCallback((token) => {
    if (!onSelectToken) return;
    onSelectToken({
      address: token.id,
      symbol: token.symbol?.toUpperCase(),
      name: token.name,
      chain: 'eth',
      logo: token.image || '🪙',
      coingeckoId: token.id,
      hasContractAddress: false
    });
  }, [onSelectToken]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.125rem', fontWeight: '600', color: THEME.text.primary }}>Market Radar</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: THEME.text.muted }}>
            Smart Money signals and anomalies across the market
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRefresh && (
            <span style={{ fontSize: '0.65rem', color: THEME.text.muted }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={loadData} disabled={loading} style={{
            padding: '6px 14px', background: THEME.bg.tertiary, border: `1px solid ${THEME.border.default}`,
            borderRadius: '6px', color: THEME.text.secondary, fontSize: '0.75rem', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {loading && <LoadingSpinner size={12} />}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Signals */}
      {signals.length > 0 && (
        <Section title="Signals" subtitle={`${signals.length} detected`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {signals.map((sig, i) => (
              <SignalCard key={i} {...sig} />
            ))}
          </div>
        </Section>
      )}

      {/* Top Flows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Inflows */}
        <Section title="Top Inflows" subtitle="Highest volume gainers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topInflow.length > 0 ? topInflow.map((token, i) => (
              <FlowTokenRow key={token.id} token={token} type="inflow" rank={i + 1} onSelect={handleSelectFlowToken} />
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.8rem' }}>No data</div>
            )}
          </div>
        </Section>

        {/* Outflows */}
        <Section title="Top Outflows" subtitle="Highest volume losers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topOutflow.length > 0 ? topOutflow.map((token, i) => (
              <FlowTokenRow key={token.id} token={token} type="outflow" rank={i + 1} onSelect={handleSelectFlowToken} />
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.8rem' }}>No data</div>
            )}
          </div>
        </Section>
      </div>

      {/* Search prompt */}
      <div style={{
        background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px',
        padding: '24px', textAlign: 'center'
      }}>
        <p style={{ margin: '0 0 4px 0', color: THEME.text.secondary, fontSize: '0.85rem' }}>
          Search for a token above to see detailed holder analysis, Smart Money activity, and token-specific insights.
        </p>
        <p style={{ margin: 0, color: THEME.text.muted, fontSize: '0.7rem' }}>
          Click any token in the flow lists to analyze it.
        </p>
      </div>
    </div>
  );
});

MarketInsights.displayName = 'MarketInsights';

export default MarketInsights;
