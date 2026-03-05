import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { THEME } from '../../utils/theme.js';
import { formatLargeUSD } from '../../utils/formatters.js';
import { COINGECKO_PLATFORM_MAP } from '../../utils/constants.js';
import { LoadingSpinner } from '../../components/shared.jsx';
import { fetchFromCoinGecko, getCoinGeckoDetail } from '../../services/api.js';
import { getSmartMoneyHoldings } from '../../services/nansen.js';

const REFRESH_INTERVAL = 60 * 60 * 1000;

// Token classification
const STABLECOINS = new Set(['usdt','usdc','dai','busd','tusd','frax','lusd','usdd','gusd','pyusd','fdusd','usdp','susd','euroc','eurt','gho','cusd','dola','usde','susde','crvusd']);
const L1_TOKENS = new Set(['btc','eth','sol','ada','avax','dot','atom','near','apt','sui','sei','ton','trx','bnb','xlm','algo','xtz','icp','hbar','egld','kas','ftm','vet','xrp','ltc','bch','etc','xmr','zec','doge','shib']);
const L2_TOKENS = new Set(['arb','op','matic','pol','mnt','metis','strk','zk','imx','skl','boba','lrc']);

function tokenCat(sym) {
  const s = (sym || '').toLowerCase();
  if (STABLECOINS.has(s)) return 'stable';
  if (L1_TOKENS.has(s)) return 'l1';
  if (L2_TOKENS.has(s)) return 'l2';
  return 'other';
}

function mcapBucket(mcap) {
  if (!mcap) return null;
  if (mcap < 50e6) return '<50m';
  if (mcap < 500e6) return '50-500m';
  if (mcap < 1e9) return '500m-1b';
  return '>1b';
}

// Severity config (dark mode)
const SEV = {
  critical: { bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.3)', color: '#f85149', dot: '#f85149' },
  warning: { bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)', color: '#d29922', dot: '#d29922' },
  positive: { bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.3)', color: '#3fb950', dot: '#3fb950' },
  info: { bg: 'rgba(88,166,255,0.08)', border: 'rgba(88,166,255,0.2)', color: '#58a6ff', dot: '#58a6ff' }
};

// ============================================
// SIGNAL CARD
// ============================================
const SignalCard = memo(({ severity, icon, title, message, metric }) => {
  const s = SEV[severity] || SEV.info;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'transform 0.15s ease' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: THEME.text.primary }}>{title}</span>
          {metric && <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{metric}</span>}
        </div>
        <div style={{ fontSize: '0.75rem', color: THEME.text.secondary, lineHeight: 1.4 }}>{message}</div>
      </div>
    </div>
  );
});
SignalCard.displayName = 'SignalCard';

// ============================================
// PRESSURE ROW — shows buy vs sell volume
// ============================================
const PressureRow = memo(({ token, type, rank, onSelect }) => {
  const change = token.price_change_percentage_24h || 0;
  const isUp = change >= 0;
  // Approximate buy/sell from price direction + volume
  const vol = token.total_volume || 0;
  const buyPct = type === 'buy' ? Math.min(95, 50 + Math.abs(change) * 2) : Math.max(5, 50 - Math.abs(change) * 2);
  const sellPct = 100 - buyPct;

  return (
    <div onClick={() => onSelect?.(token)} style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
      background: THEME.bg.secondary, borderRadius: '6px', border: `1px solid ${THEME.border.default}`,
      cursor: onSelect ? 'pointer' : 'default', transition: 'background 0.15s'
    }}
      onMouseEnter={e => onSelect && (e.currentTarget.style.background = THEME.bg.hover)}
      onMouseLeave={e => e.currentTarget.style.background = THEME.bg.secondary}>
      <span style={{
        width: '20px', height: '20px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: type === 'buy' ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)',
        color: type === 'buy' ? THEME.accent.success : THEME.accent.error,
        fontSize: '0.6rem', fontWeight: '700'
      }}>{rank}</span>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: THEME.bg.tertiary, overflow: 'hidden', flexShrink: 0 }}>
        {token.image && <img src={token.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '0.8rem', color: THEME.text.primary, textTransform: 'uppercase' }}>{token.symbol}</div>
        <div style={{ fontSize: '0.6rem', color: THEME.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
      </div>
      {/* Buy/Sell pressure bar */}
      <div style={{ width: '80px' }}>
        <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', background: THEME.bg.tertiary }}>
          <div style={{ width: `${buyPct}%`, background: THEME.accent.success }} />
          <div style={{ width: `${sellPct}%`, background: THEME.accent.error }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontSize: '0.55rem', color: THEME.accent.success }}>{buyPct.toFixed(0)}%</span>
          <span style={{ fontSize: '0.55rem', color: THEME.accent.error }}>{sellPct.toFixed(0)}%</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: '55px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: isUp ? THEME.accent.success : THEME.accent.error }}>
          {isUp ? '+' : ''}{change.toFixed(1)}%
        </div>
        <div style={{ fontSize: '0.6rem', color: THEME.text.muted }}>{formatLargeUSD(vol)}</div>
      </div>
    </div>
  );
});
PressureRow.displayName = 'PressureRow';

// ============================================
// FILTER PILL (include-based: active = included)
// ============================================
const FilterPill = memo(({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '4px 12px', borderRadius: '20px',
    background: active ? THEME.accent.primary + '30' : THEME.bg.tertiary,
    border: `1px solid ${active ? THEME.accent.primary : THEME.border.default}`,
    color: active ? THEME.accent.primary : THEME.text.muted,
    fontSize: '0.7rem', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s'
  }}>{label}</button>
));
FilterPill.displayName = 'FilterPill';

// ============================================
// MAIN COMPONENT
// ============================================
const MarketInsights = memo(({ onSelectToken }) => {
  const [marketData, setMarketData] = useState([]);
  const [smHoldings, setSmHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showAllSignals, setShowAllSignals] = useState(false);

  // Include filters (active = included in results)
  const [incStable, setIncStable] = useState(false);
  const [incL1, setIncL1] = useState(true);
  const [incL2, setIncL2] = useState(true);

  // Market cap range filters (active = included)
  const [incMcapSmall, setIncMcapSmall] = useState(true);    // <$50M
  const [incMcapMid, setIncMcapMid] = useState(true);        // $50-500M
  const [incMcapLarge, setIncMcapLarge] = useState(true);     // $500M-1B
  const [incMcapMega, setIncMcapMega] = useState(true);       // >$1B

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const market = await fetchFromCoinGecko(
        '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h'
      ).catch(err => { console.warn('CoinGecko:', err.message); return []; });

      let sm = [];
      try { sm = await getSmartMoneyHoldings(['ethereum']); } catch (e) { console.warn('Nansen SM:', e.message); }

      setMarketData(market || []);
      setSmHoldings(sm || []);
      setLastRefresh(new Date());
    } catch (err) { console.error('Market insights error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // Apply filters
  const filtered = useMemo(() => {
    const mcapFlags = { '<50m': incMcapSmall, '50-500m': incMcapMid, '500m-1b': incMcapLarge, '>1b': incMcapMega };
    const catFlags = { stable: incStable, l1: incL1, l2: incL2, other: true };
    return marketData.filter(t => {
      const cat = tokenCat(t.symbol);
      if (!catFlags[cat]) return false;
      const bucket = mcapBucket(t.market_cap);
      if (bucket && !mcapFlags[bucket]) return false;
      return true;
    });
  }, [marketData, incStable, incL1, incL2, incMcapSmall, incMcapMid, incMcapLarge, incMcapMega]);

  // Buy pressure (positive price change = net buy dominance) sorted by volume
  const { buyPressure, sellPressure } = useMemo(() => {
    const withVol = filtered.filter(t => (t.total_volume || 0) > 100000);
    const buy = [...withVol].filter(t => (t.price_change_percentage_24h || 0) > 0)
      .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0)).slice(0, 5);
    const sell = [...withVol].filter(t => (t.price_change_percentage_24h || 0) < 0)
      .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0)).slice(0, 5);
    return { buyPressure: buy, sellPressure: sell };
  }, [filtered]);

  // Signals — top 5 visible, expandable to 10
  const allSignals = useMemo(() => {
    const s = [];
    const nonStable = marketData.filter(t => tokenCat(t.symbol) !== 'stable');

    // 1. SM consensus (priority)
    if (smHoldings.length > 0) {
      const counts = {};
      smHoldings.forEach(h => {
        const sym = (h.token_symbol || h.symbol || '').toUpperCase();
        if (sym && tokenCat(sym) !== 'stable') counts[sym] = (counts[sym] || 0) + 1;
      });
      Object.entries(counts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([sym, c]) => {
        s.push({ severity: 'positive', icon: '🧠', title: `SM consensus: ${sym}`, message: `${c} Smart Money wallets/funds converging on ${sym}.`, metric: `${c} SM` });
      });
    }

    // 2. Market sentiment (priority)
    if (nonStable.length >= 50) {
      const top100 = nonStable.slice(0, 100);
      const greenPct = Math.round((top100.filter(t => (t.price_change_percentage_24h || 0) > 0).length / top100.length) * 100);
      const redPct = 100 - greenPct;
      if (greenPct >= 75) s.push({ severity: 'positive', icon: '🟢', title: 'Broad market rally', message: `${greenPct}% of top tokens positive in 24h.`, metric: `${greenPct}% green` });
      else if (redPct >= 75) s.push({ severity: 'critical', icon: '🔴', title: 'Broad market selloff', message: `${redPct}% of top tokens negative in 24h.`, metric: `${redPct}% red` });
      else if (greenPct >= 60) s.push({ severity: 'info', icon: '📈', title: 'Market leaning bullish', message: `${greenPct}% of top tokens positive.`, metric: `${greenPct}% green` });
      else if (redPct >= 60) s.push({ severity: 'warning', icon: '📉', title: 'Market leaning bearish', message: `${redPct}% of top tokens negative.`, metric: `${redPct}% red` });
    }

    // 3. Volume spikes
    const volRatios = nonStable.filter(t => t.market_cap > 1e6 && t.total_volume > 0)
      .map(t => ({ ...t, vr: t.total_volume / t.market_cap })).sort((a, b) => b.vr - a.vr);
    const medVR = volRatios.length > 10 ? volRatios[Math.floor(volRatios.length / 2)].vr : 0.05;
    volRatios.filter(t => t.vr > medVR * 3 && t.market_cap > 1e7).slice(0, 3).forEach(t => {
      s.push({ severity: 'warning', icon: '📊', title: `Volume spike: ${t.symbol?.toUpperCase()}`, message: `24h volume is ${(t.vr / medVR).toFixed(1)}x median ratio. Price ${(t.price_change_percentage_24h || 0) >= 0 ? 'up' : 'down'} ${Math.abs(t.price_change_percentage_24h || 0).toFixed(1)}%.`, metric: `${(t.vr / medVR).toFixed(1)}x vol` });
    });

    // 4. SM accumulation
    if (smHoldings.length > 0) {
      smHoldings.filter(h => (h.holders_count || 0) > 5 && (h.balance_24h_percent_change || 0) > 10 && tokenCat(h.token_symbol || h.symbol || '') !== 'stable')
        .slice(0, 3).forEach(h => {
          const sym = (h.token_symbol || h.symbol || '?').toUpperCase();
          s.push({ severity: 'positive', icon: '📤', title: `SM accumulation: ${sym}`, message: `SM positions up ${(h.balance_24h_percent_change || 0).toFixed(1)}% across ${h.holders_count} wallets.`, metric: `+${(h.balance_24h_percent_change || 0).toFixed(1)}%` });
        });
    }

    // 5. Mid-cap momentum
    nonStable.filter(t => t.market_cap > 5e6 && t.market_cap < 5e8 && (t.price_change_percentage_24h || 0) > 10)
      .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 3).forEach(t => {
        s.push({ severity: 'info', icon: '🆕', title: `Momentum: ${t.symbol?.toUpperCase()}`, message: `${t.name} up ${(t.price_change_percentage_24h || 0).toFixed(1)}% with ${formatLargeUSD(t.total_volume)} volume.`, metric: `+${(t.price_change_percentage_24h || 0).toFixed(1)}%` });
      });

    return s;
  }, [marketData, smHoldings]);

  const visibleSignals = showAllSignals ? allSignals.slice(0, 10) : allSignals.slice(0, 5);
  const canExpand = allSignals.length > 5 && !showAllSignals;
  const canCollapse = showAllSignals;

  // Chain-agnostic token selection
  const handleSelectToken = useCallback(async (token) => {
    if (!onSelectToken) return;
    try {
      const cg = await getCoinGeckoDetail(token.id);
      let addr = null, chain = 'eth';
      if (cg?.platforms) {
        for (const [p, a] of Object.entries(cg.platforms)) {
          if (a && COINGECKO_PLATFORM_MAP[p]) { addr = a; chain = COINGECKO_PLATFORM_MAP[p]; break; }
        }
      }
      onSelectToken({ address: addr || token.id, symbol: token.symbol?.toUpperCase(), name: token.name, chain, logo: token.image || '🪙', coingeckoId: token.id, hasContractAddress: !!addr });
    } catch {
      onSelectToken({ address: token.id, symbol: token.symbol?.toUpperCase(), name: token.name, chain: 'eth', logo: token.image || '🪙', coingeckoId: token.id, hasContractAddress: false });
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.125rem', fontWeight: '600', color: THEME.text.primary }}>Market Radar</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: THEME.text.muted }}>Smart Money signals and market-wide anomalies</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRefresh && <span style={{ fontSize: '0.65rem', color: THEME.text.muted }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={loadData} disabled={loading} style={{ padding: '6px 14px', background: THEME.bg.tertiary, border: `1px solid ${THEME.border.default}`, borderRadius: '6px', color: THEME.text.secondary, fontSize: '0.75rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading && <LoadingSpinner size={12} />}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: THEME.text.muted, marginRight: '2px' }}>Include:</span>
        <FilterPill label="Stablecoins" active={incStable} onClick={() => setIncStable(!incStable)} />
        <FilterPill label="L1 Tokens" active={incL1} onClick={() => setIncL1(!incL1)} />
        <FilterPill label="L2 Tokens" active={incL2} onClick={() => setIncL2(!incL2)} />
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: THEME.text.muted, marginRight: '2px' }}>Market Cap:</span>
        <FilterPill label="<$50M" active={incMcapSmall} onClick={() => setIncMcapSmall(!incMcapSmall)} />
        <FilterPill label="$50-500M" active={incMcapMid} onClick={() => setIncMcapMid(!incMcapMid)} />
        <FilterPill label="$500M-1B" active={incMcapLarge} onClick={() => setIncMcapLarge(!incMcapLarge)} />
        <FilterPill label=">$1B" active={incMcapMega} onClick={() => setIncMcapMega(!incMcapMega)} />
      </div>

      {/* Signals */}
      {visibleSignals.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>
              {showAllSignals ? 'Signals (expanded)' : 'Top Signals'}
            </h3>
            <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>{allSignals.length} total</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleSignals.map((sig, i) => <SignalCard key={i} {...sig} />)}
          </div>
          {(canExpand || canCollapse) && (
            <button onClick={() => setShowAllSignals(!showAllSignals)} style={{
              display: 'block', width: '100%', marginTop: '10px', padding: '10px',
              background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`,
              borderRadius: '6px', color: THEME.accent.primary, fontSize: '0.8rem', fontWeight: '500',
              cursor: 'pointer', textAlign: 'center'
            }}>
              {showAllSignals ? 'Show top 5 only' : `View up to ${Math.min(10, allSignals.length)} signals`}
            </button>
          )}
        </div>
      )}

      {/* Buy/Sell Pressure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.accent.success }}>Buy Pressure</h3>
            <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>Highest buy-dominant volume</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {buyPressure.length > 0 ? buyPressure.map((t, i) => (
              <PressureRow key={t.id} token={t} type="buy" rank={i + 1} onSelect={handleSelectToken} />
            )) : <div style={{ padding: '20px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.8rem' }}>No data</div>}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.accent.error }}>Sell Pressure</h3>
            <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>Highest sell-dominant volume</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sellPressure.length > 0 ? sellPressure.map((t, i) => (
              <PressureRow key={t.id} token={t} type="sell" rank={i + 1} onSelect={handleSelectToken} />
            )) : <div style={{ padding: '20px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.8rem' }}>No data</div>}
          </div>
        </div>
      </div>

      {/* Search prompt */}
      <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
        <p style={{ margin: 0, color: THEME.text.secondary, fontSize: '0.8rem' }}>
          Search for a token above or click any token to see detailed analysis.
        </p>
      </div>
    </div>
  );
});

MarketInsights.displayName = 'MarketInsights';
export default MarketInsights;
