import React, { useMemo, memo } from 'react';
import { THEME } from '../../utils/theme.js';
import { NETWORKS } from '../../utils/constants.js';
import { formatLargeUSD } from '../../utils/formatters.js';

const PoolsTable = memo(({ pools }) => {
  if (!pools || pools.length === 0) return null;

  const { totalLiquidity, totalVolume, totalBuys, totalSells, buyVolume, sellVolume, totalTxs } = useMemo(() => {
    const totalLiq = pools.reduce((sum, p) => sum + (p.liquidity_usd || 0), 0);
    const totalVol = pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);
    const buys = pools.reduce((sum, p) => sum + (p.buys_24h || 0), 0);
    const sells = pools.reduce((sum, p) => sum + (p.sells_24h || 0), 0);
    const txs = buys + sells;
    const buyVol = txs > 0 ? (totalVol * buys / txs) : 0;
    const sellVol = txs > 0 ? (totalVol * sells / txs) : 0;
    return { totalLiquidity: totalLiq, totalVolume: totalVol, totalBuys: buys, totalSells: sells, buyVolume: buyVol, sellVolume: sellVol, totalTxs: txs };
  }, [pools]);

  return (
    <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>Liquidity & Activity</h3>
      
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: THEME.text.muted, marginBottom: '4px' }}>Liquidity</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: THEME.text.primary }}>{formatLargeUSD(totalLiquidity)}</div>
        </div>
        <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: THEME.text.muted, marginBottom: '4px' }}>24h Volume</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: THEME.text.primary }}>{formatLargeUSD(totalVolume)}</div>
        </div>
        <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: THEME.accent.success, marginBottom: '4px' }}>Buy Vol</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: THEME.accent.success }}>{formatLargeUSD(buyVolume)}</div>
          <div style={{ fontSize: '0.65rem', color: THEME.text.muted }}>{totalBuys.toLocaleString()} txns</div>
        </div>
        <div style={{ background: THEME.bg.tertiary, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: THEME.accent.error, marginBottom: '4px' }}>Sell Vol</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: THEME.accent.error }}>{formatLargeUSD(sellVolume)}</div>
          <div style={{ fontSize: '0.65rem', color: THEME.text.muted }}>{totalSells.toLocaleString()} txns</div>
        </div>
      </div>

      {/* Buy/Sell Ratio Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: THEME.text.muted }}>
          <span>Buys</span>
          <span>Sells</span>
        </div>
        <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: THEME.bg.tertiary }}>
          <div style={{ width: `${totalTxs > 0 ? (totalBuys / totalTxs * 100) : 50}%`, background: THEME.accent.success, transition: 'width 0.3s' }} />
          <div style={{ width: `${totalTxs > 0 ? (totalSells / totalTxs * 100) : 50}%`, background: THEME.accent.error, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.7rem' }}>
          <span style={{ color: THEME.accent.success }}>{totalTxs > 0 ? (totalBuys / totalTxs * 100).toFixed(1) : 50}%</span>
          <span style={{ color: THEME.accent.error }}>{totalTxs > 0 ? (totalSells / totalTxs * 100).toFixed(1) : 50}%</span>
        </div>
      </div>

      {/* Pools Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${THEME.border.default}` }}>
              <th style={{ padding: '10px', textAlign: 'left', color: THEME.text.muted, fontWeight: '500' }}>Pool</th>
              <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>Liquidity</th>
              <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>24h Vol</th>
              <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>Buys</th>
              <th style={{ padding: '10px', textAlign: 'right', color: THEME.text.muted, fontWeight: '500' }}>Sells</th>
            </tr>
          </thead>
          <tbody>
            {pools.slice(0, 6).map((pool, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${THEME.border.subtle}` }}>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {pool.chain && (
                      <span style={{
                        background: THEME.bg.tertiary,
                        color: THEME.text.secondary,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.65rem',
                        fontWeight: '500'
                      }}>
                        {NETWORKS[pool.chain]?.name?.slice(0, 3) || pool.chain}
                      </span>
                    )}
                    <div>
                      <div style={{ fontWeight: '500', color: THEME.text.primary }}>{pool.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.7rem', color: THEME.text.muted }}>{pool.dex}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', color: THEME.text.primary }}>{formatLargeUSD(pool.liquidity_usd)}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: THEME.text.primary }}>{formatLargeUSD(pool.volume_24h)}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: THEME.accent.success, fontWeight: '500' }}>{(pool.buys_24h || 0).toLocaleString()}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: THEME.accent.error, fontWeight: '500' }}>{(pool.sells_24h || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

PoolsTable.displayName = 'PoolsTable';

export default PoolsTable;
