import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { THEME } from '../../utils/theme.js';
import { formatLargeUSD, formatNumber, shortenAddress, formatTimeAgo } from '../../utils/formatters.js';
import { LoadingSpinner, AddressDisplay } from '../../components/shared.jsx';
import { useAbortController } from '../../utils/hooks.js';
import {
  getTokenHolders, getTokenFlows, getWhoBoughtSold, calculateGini
} from '../../services/nansen.js';

// ============================================
// ENTITY BADGE
// ============================================

const EntityBadge = memo(({ type, name }) => {
  const config = {
    fund: { bg: 'rgba(168, 85, 247, 0.2)', color: '#a855f7', icon: '🏦' },
    whale: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', icon: '🐋' },
    exchange: { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', icon: '🏛️' },
    smart_trader: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', icon: '🧠' },
    smart_money: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', icon: '💰' },
    labeled: { bg: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa', icon: '🏷️' },
    public_figure: { bg: 'rgba(251, 146, 60, 0.2)', color: '#fb923c', icon: '⭐' },
    dao: { bg: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6', icon: '🏛️' },
    default: { bg: 'rgba(107, 114, 128, 0.2)', color: '#6b7280', icon: '👤' }
  };
  const c = config[type?.toLowerCase()] || config.default;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: c.bg, color: c.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600', textTransform: 'uppercase' }}>
      {c.icon} {name || type || 'Unknown'}
    </span>
  );
});
EntityBadge.displayName = 'EntityBadge';

// ============================================
// FLOW BAR
// ============================================

const FlowBar = memo(({ inflows, outflows, label }) => {
  const total = inflows + outflows;
  if (total === 0) return null;
  const inflowPct = (inflows / total) * 100;
  const isNetPositive = inflows > outflows;

  return (
    <div style={{ marginBottom: '12px' }}>
      {label && <div style={{ fontSize: '0.75rem', color: THEME.text.secondary, marginBottom: '6px', fontWeight: '500' }}>{label}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem' }}>
        <span style={{ color: THEME.accent.success }}>In: {inflows}</span>
        <span style={{ color: THEME.accent.error }}>Out: {outflows}</span>
      </div>
      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: THEME.bg.tertiary }}>
        <div style={{ width: `${inflowPct}%`, background: THEME.accent.success, transition: 'width 0.5s ease' }} />
        <div style={{ width: `${100 - inflowPct}%`, background: THEME.accent.error, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ textAlign: 'center', marginTop: '4px' }}>
        <span style={{ background: isNetPositive ? 'rgba(16,185,129,0.15)' : 'rgba(248,81,73,0.15)', color: isNetPositive ? THEME.accent.success : THEME.accent.error, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
          Net: {isNetPositive ? '+' : ''}{inflows - outflows}
        </span>
      </div>
    </div>
  );
});
FlowBar.displayName = 'FlowBar';

// ============================================
// GINI GAUGE
// ============================================

const GiniGauge = memo(({ giniCoefficient }) => {
  const pct = giniCoefficient * 100;
  const label = pct > 80 ? 'Extreme' : pct > 60 ? 'High' : pct > 40 ? 'Moderate' : 'Low';
  const color = pct > 80 ? THEME.accent.error : pct > 60 ? THEME.accent.warning : pct > 40 ? '#d29922' : THEME.accent.success;

  return (
    <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: THEME.text.primary }}>Gini Coefficient</span>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, height: '6px', background: THEME.bg.tertiary, borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${THEME.accent.success}, ${THEME.accent.warning}, ${THEME.accent.error})`, borderRadius: '3px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: '1rem', fontWeight: '700', color, minWidth: '45px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {giniCoefficient.toFixed(3)}
        </span>
      </div>
      <div style={{ fontSize: '0.65rem', color: THEME.text.muted, marginTop: '6px' }}>0 = equal distribution · 1 = one holder owns all</div>
    </div>
  );
});
GiniGauge.displayName = 'GiniGauge';

// ============================================
// ENTITY FLOW CARD
// ============================================

const EntityFlowCard = memo(({ entity }) => {
  const isNetBuyer = entity.is_net_buyer;
  return (
    <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <EntityBadge type={entity.entity_type} name={entity.entity_name} />
        <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>{entity.holders_count} holders</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: isNetBuyer ? THEME.accent.success : THEME.accent.error }}>
          {isNetBuyer ? '↑ Net Buyer' : '↓ Net Seller'}
        </div>
        <div style={{ fontSize: '0.65rem', color: THEME.text.muted }}>
          In: {entity.total_inflows} · Out: {entity.total_outflows}
        </div>
      </div>
    </div>
  );
});
EntityFlowCard.displayName = 'EntityFlowCard';

// ============================================
// SMART MONEY TAB (Main Component)
// ============================================

const SmartMoneyTab = memo(({ selectedToken, holders, prefetchedSmHolders, prefetchedFlows, prefetchedWhoBoughtSold }) => {
  const [timeframeDays, setTimeframeDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [smHolders, setSmHolders] = useState(prefetchedSmHolders || []);
  const [flowData, setFlowData] = useState(prefetchedFlows || []);
  const [whoBoughtSold, setWhoBoughtSold] = useState(prefetchedWhoBoughtSold || null);
  const { getSignal } = useAbortController();

  // Sync prefetched data when it arrives
  React.useEffect(() => {
    if (prefetchedSmHolders?.length > 0 && smHolders.length === 0) setSmHolders(prefetchedSmHolders);
  }, [prefetchedSmHolders]);
  React.useEffect(() => {
    if (prefetchedFlows?.length > 0 && flowData.length === 0) setFlowData(prefetchedFlows);
  }, [prefetchedFlows]);
  React.useEffect(() => {
    if (prefetchedWhoBoughtSold && !whoBoughtSold) setWhoBoughtSold(prefetchedWhoBoughtSold);
  }, [prefetchedWhoBoughtSold]);

  const giniCoefficient = useMemo(() => calculateGini(holders), [holders]);

  const loadSmartMoneyData = useCallback(async () => {
    if (!selectedToken?.address || selectedToken.chain === 'solana') return;

    setLoading(true);
    setError(null);
    const signal = getSignal();

    try {
      const [smHolderData, smFlows, whoBuySell] = await Promise.all([
        getTokenHolders(selectedToken.address, selectedToken.chain, { labelType: 'smart_money', perPage: 50 }, signal)
          .catch(e => { console.warn('SM holders failed:', e.message); return []; }),
        getTokenFlows(selectedToken.address, selectedToken.chain, { label: 'smart_money', days: timeframeDays }, signal)
          .catch(e => { console.warn('SM flows failed:', e.message); return []; }),
        getWhoBoughtSold(selectedToken.address, selectedToken.chain, { days: timeframeDays }, signal)
          .catch(e => { console.warn('Who bought/sold failed:', e.message); return null; })
      ]);

      if (!signal.aborted) {
        setSmHolders(smHolderData);
        setFlowData(smFlows);
        setWhoBoughtSold(whoBuySell);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        if (err.message === 'NANSEN_NOT_CONFIGURED') {
          setError('Nansen API key not configured. Add NANSEN_API_KEY to your Vercel environment variables.');
        } else if (err.message === 'NANSEN_CREDITS_EXHAUSTED') {
          setError('Nansen API credits exhausted for this billing period.');
        } else if (err.message === 'NANSEN_RATE_LIMITED') {
          setError('Rate limited. Will retry automatically.');
        } else if (err.message === 'NANSEN_AUTH_FAILED') {
          setError('Nansen API key is invalid. Please check your key in Vercel environment variables.');
        } else {
          setError(err.message);
        }
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [selectedToken, timeframeDays, getSignal]);

  useEffect(() => { loadSmartMoneyData(); }, [loadSmartMoneyData]);

  // Compute flow summary from time series
  const flowSummary = useMemo(() => {
    if (!flowData || flowData.length === 0) return null;
    const totalIn = flowData.reduce((s, f) => s + f.total_inflows, 0);
    const totalOut = flowData.reduce((s, f) => s + f.total_outflows, 0);
    const latestHolders = flowData[flowData.length - 1]?.holders_count || 0;
    const firstHolders = flowData[0]?.holders_count || 0;
    const holderChange = latestHolders - firstHolders;
    return { totalIn, totalOut, net: totalIn - totalOut, latestHolders, holderChange };
  }, [flowData]);

  const timeframeLabel = timeframeDays === 1 ? '24h' : timeframeDays === 7 ? '7d' : '30d';

  return (
    <div>
      {/* Header + Timeframe */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: THEME.text.primary }}>Smart Money Activity</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ d: 1, label: '24h' }, { d: 7, label: '7d' }, { d: 30, label: '30d' }].map(tf => (
            <button key={tf.d} onClick={() => setTimeframeDays(tf.d)} style={{
              padding: '5px 12px',
              background: timeframeDays === tf.d ? THEME.accent.primary : THEME.bg.tertiary,
              border: `1px solid ${timeframeDays === tf.d ? THEME.accent.primary : THEME.border.default}`,
              borderRadius: '4px', color: timeframeDays === tf.d ? '#fff' : THEME.text.secondary,
              fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer'
            }}>{tf.label}</button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.accent.error}40`, borderRadius: '8px', padding: '16px', marginBottom: '20px', color: THEME.accent.error, fontSize: '0.8rem' }}>
          {error}
          <button onClick={loadSmartMoneyData} style={{ marginLeft: '12px', padding: '4px 12px', background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '4px', color: THEME.text.secondary, fontSize: '0.75rem', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', background: THEME.bg.secondary, borderRadius: '8px', border: `1px solid ${THEME.border.default}` }}>
          <LoadingSpinner size={24} />
          <span style={{ marginLeft: '12px', color: THEME.text.secondary }}>Loading Smart Money data from Nansen...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Gini Coefficient */}
          {holders && holders.length > 0 && (
            <div style={{ marginBottom: '20px' }}><GiniGauge giniCoefficient={giniCoefficient} /></div>
          )}

          {/* Smart Money Flow Summary */}
          {flowSummary && (
            <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.875rem', fontWeight: '600', color: THEME.text.primary }}>
                Smart Money Flow ({timeframeLabel})
              </h4>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: THEME.accent.success, marginBottom: '2px' }}>Inflows</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: THEME.accent.success }}>{flowSummary.totalIn}</div>
                </div>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: THEME.accent.error, marginBottom: '2px' }}>Outflows</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: THEME.accent.error }}>{flowSummary.totalOut}</div>
                </div>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: THEME.text.muted, marginBottom: '2px' }}>Net Flow</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: flowSummary.net >= 0 ? THEME.accent.success : THEME.accent.error }}>
                    {flowSummary.net >= 0 ? '+' : ''}{flowSummary.net}
                  </div>
                </div>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: THEME.text.muted, marginBottom: '2px' }}>SM Holders</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: THEME.text.primary }}>{flowSummary.latestHolders}</div>
                  {flowSummary.holderChange !== 0 && (
                    <div style={{ fontSize: '0.6rem', color: flowSummary.holderChange > 0 ? THEME.accent.success : THEME.accent.error }}>
                      {flowSummary.holderChange > 0 ? '+' : ''}{flowSummary.holderChange}
                    </div>
                  )}
                </div>
              </div>

              <FlowBar inflows={flowSummary.totalIn} outflows={flowSummary.totalOut} label="Smart Money Transactions" />
            </div>
          )}

          {/* Who Bought / Sold — entity breakdown */}
          {whoBoughtSold && (
            <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.875rem', fontWeight: '600', color: THEME.text.primary }}>
                Entity Activity ({timeframeLabel})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...whoBoughtSold.buyers, ...whoBoughtSold.sellers].map((entity, i) => (
                  <EntityFlowCard key={i} entity={entity} />
                ))}
              </div>
              {whoBoughtSold.net_flow !== 0 && (
                <div style={{ textAlign: 'center', marginTop: '12px', padding: '8px', background: THEME.bg.tertiary, borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: whoBoughtSold.net_flow > 0 ? THEME.accent.success : THEME.accent.error }}>
                    Overall: {whoBoughtSold.net_flow > 0 ? 'Net Accumulation ↑' : 'Net Distribution ↓'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Smart Money Holder Table */}
          {smHolders.length > 0 && (
            <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.875rem', fontWeight: '600', color: THEME.text.primary }}>
                Smart Money Holders ({smHolders.length})
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.border.default}` }}>
                      <th style={{ padding: '10px', textAlign: 'left', color: THEME.text.muted, fontWeight: '500' }}>Address</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: THEME.text.muted, fontWeight: '500' }}>Label</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>Balance</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>Value</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>% Supply</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>24h Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smHolders.slice(0, 25).map((h, i) => (
                      <tr key={h.owner_address || i} style={{ borderBottom: `1px solid ${THEME.border.subtle}` }}>
                        <td style={{ padding: '10px' }}>
                          <AddressDisplay address={h.owner_address} chain={selectedToken.chain} />
                        </td>
                        <td style={{ padding: '10px' }}>
                          <EntityBadge type={h.entity_type} name={h.entity_name} />
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: THEME.text.primary, fontWeight: '500' }}>
                          {formatNumber(parseFloat(h.balance_formatted) || 0)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: THEME.accent.success, fontWeight: '500' }}>
                          {formatLargeUSD(h.usd_value)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: THEME.text.secondary }}>
                          {(h.percentage_relative_to_total_supply || 0).toFixed(2)}%
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {h.balance_change_24h != null ? (
                            <span style={{ color: h.balance_change_24h >= 0 ? THEME.accent.success : THEME.accent.error, fontWeight: '500' }}>
                              {h.balance_change_24h >= 0 ? '+' : ''}{formatNumber(h.balance_change_24h)}
                            </span>
                          ) : <span style={{ color: THEME.text.muted }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!flowSummary && smHolders.length === 0 && !whoBoughtSold && !error && (
            <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '40px', textAlign: 'center', color: THEME.text.muted }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🧠</div>
              <p style={{ margin: '0 0 8px 0', color: THEME.text.secondary, fontWeight: '500' }}>No Smart Money data available</p>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>This token may not have Smart Money activity tracked by Nansen, or the API key may need to be verified.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
});

SmartMoneyTab.displayName = 'SmartMoneyTab';

export default SmartMoneyTab;
