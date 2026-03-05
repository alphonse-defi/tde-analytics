import React, { useMemo, memo } from 'react';
import { THEME } from '../../utils/theme.js';

const HolderDistributionChart = memo(({ holders, tokenInfo }) => {
  if (!holders || holders.length === 0) return null;

  // Memoize all expensive concentration calculations
  const { segments, top10Total, isHighlyConcentrated, concentrationLabel, concentrationColor, isMultiChain, chainsFetched } = useMemo(() => {
    const multi = holders.isMultiChain || false;
    const chains = holders.chainsFetched || [];
    
    const rawTop10Total = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percentage_relative_to_total_supply || 0), 0);
    const rawTop25Total = holders.slice(0, 25).reduce((sum, h) => sum + parseFloat(h.percentage_relative_to_total_supply || 0), 0);
    const rawTop50Total = holders.slice(0, 50).reduce((sum, h) => sum + parseFloat(h.percentage_relative_to_total_supply || 0), 0);
    const rawTop100Total = holders.slice(0, 100).reduce((sum, h) => sum + parseFloat(h.percentage_relative_to_total_supply || 0), 0);
    
    const normalizationFactor = rawTop100Total > 100 ? 100 / rawTop100Total : 1;
    const t10 = Math.min(rawTop10Total * normalizationFactor, 100);
    const top25Total = Math.min(rawTop25Total * normalizationFactor, 100);
    const top50Total = Math.min(rawTop50Total * normalizationFactor, 100);
    const top100Total = Math.min(rawTop100Total * normalizationFactor, 100);
    const othersPercent = Math.max(0, 100 - top100Total);

    const segs = [
      { label: 'Top 10', percent: t10, color: THEME.accent.primary },
      { label: 'Top 11-25', percent: Math.max(0, top25Total - t10), color: '#58a6ff' },
      { label: 'Top 26-50', percent: Math.max(0, top50Total - top25Total), color: '#3fb950' },
      { label: 'Top 51-100', percent: Math.max(0, top100Total - top50Total), color: '#d29922' },
      { label: 'Others', percent: othersPercent, color: THEME.bg.tertiary }
    ].filter(s => s.percent > 0.1);

    const highConc = t10 > 50;
    const concLabel = t10 > 70 ? 'Very High' : t10 > 50 ? 'High' : t10 > 30 ? 'Moderate' : 'Low';
    const concColor = t10 > 70 ? THEME.accent.error : t10 > 50 ? THEME.accent.warning : t10 > 30 ? '#d29922' : THEME.accent.success;

    return { 
      segments: segs, 
      top10Total: t10, 
      isHighlyConcentrated: highConc, 
      concentrationLabel: concLabel, 
      concentrationColor: concColor,
      isMultiChain: multi,
      chainsFetched: chains
    };
  }, [holders]);

  const circumference = 2 * Math.PI * 70;

  // Memoize donut chart segments
  const donutSegments = useMemo(() => {
    let cumulative = 0;
    return segments.map((segment) => {
      const dashArray = (segment.percent / 100) * circumference;
      const dashOffset = -cumulative * circumference / 100;
      cumulative += segment.percent;
      return { ...segment, dashArray, dashOffset };
    });
  }, [segments, circumference]);

  return (
    <div style={{ 
      background: THEME.bg.secondary, 
      border: `1px solid ${THEME.border.default}`, 
      borderRadius: '8px', 
      padding: '20px', 
      marginBottom: '20px' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '600', color: THEME.text.primary }}>Holder Distribution</h3>
          {isMultiChain && (
            <span style={{ 
              fontSize: '0.7rem', 
              background: THEME.bg.tertiary,
              border: `1px solid ${THEME.border.default}`,
              padding: '2px 8px', 
              borderRadius: '4px',
              color: THEME.text.secondary
            }}>
              {chainsFetched.length} chains
            </span>
          )}
        </div>
        <div style={{
          background: THEME.bg.tertiary,
          border: `1px solid ${THEME.border.default}`,
          color: concentrationColor,
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '500'
        }}>
          {concentrationLabel}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Donut Chart */}
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            {donutSegments.map((segment, i) => (
              <circle 
                key={i} 
                cx="80" 
                cy="80" 
                r="70" 
                fill="none" 
                stroke={segment.color} 
                strokeWidth="16" 
                strokeDasharray={`${segment.dashArray} ${circumference}`} 
                strokeDashoffset={segment.dashOffset} 
                transform="rotate(-90 80 80)" 
              />
            ))}
          </svg>
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: THEME.text.primary }}>{top10Total.toFixed(1)}%</div>
            <div style={{ fontSize: '0.7rem', color: THEME.text.muted }}>Top 10</div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, minWidth: '180px' }}>
          {segments.map((segment, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              marginBottom: '8px',
              padding: '6px 10px',
              background: THEME.bg.tertiary,
              borderRadius: '4px'
            }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '3px', 
                background: segment.color,
                flexShrink: 0
              }} />
              <span style={{ fontSize: '0.8rem', color: THEME.text.secondary, flex: 1 }}>{segment.label}</span>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '600', 
                color: THEME.text.primary,
                minWidth: '50px',
                textAlign: 'right'
              }}>
                {segment.percent.toFixed(1)}%
              </span>
            </div>
          ))}
          
          <div style={{ 
            marginTop: '12px', 
            padding: '10px', 
            background: THEME.bg.tertiary, 
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: THEME.text.muted
          }}>
            Based on top {holders.length} holders
            {isHighlyConcentrated && <span style={{ color: THEME.accent.warning }}> • High concentration risk</span>}
          </div>
        </div>
      </div>
    </div>
  );
});

HolderDistributionChart.displayName = 'HolderDistributionChart';

export default HolderDistributionChart;
