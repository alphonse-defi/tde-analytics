import React, { useMemo, memo } from 'react';
import { THEME } from '../../utils/theme.js';
import { NETWORKS } from '../../utils/constants.js';
import { formatLargeUSD, formatSupply } from '../../utils/formatters.js';

const TokenMetricsCard = memo(({ tokenInfo, holders, poolsData }) => {
  // Memoize liquidity calculation
  const { totalLiquidity, chainsWithPools, isMultiChain } = useMemo(() => {
    const totalLiq = poolsData?.reduce((sum, p) => sum + (p.liquidity_usd || 0), 0) || 0;
    const chains = poolsData?.chainsFetched?.length || 1;
    const multi = poolsData?.isMultiChain || (holders?.isMultiChain);
    return { totalLiquidity: totalLiq, chainsWithPools: chains, isMultiChain: multi };
  }, [poolsData, holders?.isMultiChain]);

  const metrics = useMemo(() => [
    { label: 'Market Cap', value: formatLargeUSD(tokenInfo?.market_cap) },
    { label: 'FDV', value: formatLargeUSD(tokenInfo?.fully_diluted_valuation) },
    { label: '24h Volume', value: formatLargeUSD(tokenInfo?.total_volume) },
    { label: 'DEX Liquidity', value: formatLargeUSD(totalLiquidity), highlight: true },
    { label: 'Circulating', value: formatSupply(tokenInfo?.circulating_supply) },
    { label: 'Holders', value: holders?.length ? `${holders.length}+` : '-' },
  ], [tokenInfo, totalLiquidity, holders?.length]);

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Multi-chain indicator */}
      {isMultiChain && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '12px',
          padding: '10px 14px',
          background: THEME.bg.tertiary,
          border: `1px solid ${THEME.border.default}`,
          borderRadius: '6px'
        }}>
          <span style={{ fontSize: '0.8rem', color: THEME.text.secondary }}>
            Multi-chain token — Data from {chainsWithPools} networks
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {poolsData?.chainsFetched?.map(chain => (
              <span key={chain} style={{
                background: THEME.bg.secondary,
                color: THEME.text.secondary,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '500',
                border: `1px solid ${THEME.border.default}`
              }}>
                {NETWORKS[chain]?.name || chain}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        {metrics.map(({ label, value, highlight }) => (
          <div key={label} style={{ 
            background: THEME.bg.secondary, 
            border: `1px solid ${highlight ? THEME.accent.primary + '40' : THEME.border.default}`, 
            borderRadius: '8px', 
            padding: '14px' 
          }}>
            <div style={{ fontSize: '0.7rem', color: THEME.text.muted, marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: highlight ? THEME.accent.primary : THEME.text.primary }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

TokenMetricsCard.displayName = 'TokenMetricsCard';

export default TokenMetricsCard;
