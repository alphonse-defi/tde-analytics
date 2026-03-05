import React, { useState, useRef, useMemo, memo, useCallback } from 'react';
import { THEME } from '../../utils/theme.js';
import { formatPrice } from '../../utils/formatters.js';

const PriceChart = memo(({ data, timeframe, setTimeframe }) => {
  const [hoverData, setHoverData] = useState(null);
  const [hoverX, setHoverX] = useState(null);
  const chartRef = useRef(null);

  const chartMetrics = useMemo(() => {
    if (!data || data.length === 0) return null;
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const currentPrice = prices[prices.length - 1];
    const startPrice = prices[0];
    const priceChange = ((currentPrice - startPrice) / startPrice * 100);
    const isPositive = priceChange >= 0;
    const targetPoints = 50;
    const step = Math.max(1, Math.floor(data.length / targetPoints));
    const chartData = data.filter((_, i) => i % step === 0 || i === data.length - 1);
    return { prices, minPrice, maxPrice, priceRange, currentPrice, startPrice, priceChange, isPositive, chartData };
  }, [data]);

  const { linePath, areaPath, gradientId, lineColor } = useMemo(() => {
    if (!chartMetrics) return { linePath: '', areaPath: '', gradientId: '', lineColor: '' };
    const { minPrice, priceRange, isPositive, chartData } = chartMetrics;
    const W = 400, H = 80;
    const pad = { top: 6, bottom: 14, left: 0, right: 0 };
    const gH = H - pad.top - pad.bottom;
    const gW = W - pad.left - pad.right;

    const getPoint = (i) => ({
      x: pad.left + (i / (chartData.length - 1)) * gW,
      y: pad.top + gH - ((chartData[i].price - minPrice) / priceRange) * gH
    });

    let path = `M ${getPoint(0).x} ${getPoint(0).y}`;
    for (let i = 0; i < chartData.length - 1; i++) {
      const p0 = getPoint(Math.max(0, i - 1));
      const p1 = getPoint(i);
      const p2 = getPoint(Math.min(chartData.length - 1, i + 1));
      const p3 = getPoint(Math.min(chartData.length - 1, i + 2));
      const t = 0.3;
      path += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
    }

    const lastX = pad.left + gW;
    const aPath = `${path} L ${lastX} ${pad.top + gH} L ${pad.left} ${pad.top + gH} Z`;
    const gId = `pg_${isPositive ? 'u' : 'd'}`;
    const lColor = isPositive ? THEME.accent.success : THEME.accent.error;
    return { linePath: path, areaPath: aPath, gradientId: gId, lineColor: lColor };
  }, [chartMetrics]);

  const handleMouseMove = useCallback((e) => {
    if (!chartRef.current || !chartMetrics) return;
    const rect = chartRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const { chartData } = chartMetrics;
    const index = Math.min(Math.max(0, Math.round(relativeX * (chartData.length - 1))), chartData.length - 1);
    const dataPoint = chartData[index];
    if (dataPoint) { setHoverData(dataPoint); setHoverX(relativeX * 100); }
  }, [chartMetrics]);

  const handleMouseLeave = useCallback(() => { setHoverData(null); setHoverX(null); }, []);

  if (!chartMetrics) {
    return (
      <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '6px', padding: '16px', textAlign: 'center', color: THEME.text.muted, fontSize: '0.75rem' }}>
        No price data available
      </div>
    );
  }

  const { minPrice, maxPrice, priceRange, currentPrice, priceChange, isPositive, chartData } = chartMetrics;
  const W = 400, H = 80;
  const pad = { top: 6, bottom: 14, left: 0, right: 0 };
  const gH = H - pad.top - pad.bottom;
  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{
      background: THEME.bg.secondary,
      border: `1px solid ${THEME.border.default}`,
      borderRadius: '6px',
      padding: '14px 16px',
      marginBottom: '16px'
    }}>
      {/* Compact header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: '600', color: THEME.text.primary, fontVariantNumeric: 'tabular-nums' }}>
            ${formatPrice(hoverData?.price || currentPrice)}
          </span>
          <span style={{ fontSize: '0.75rem', color: isPositive ? THEME.accent.success : THEME.accent.error, fontWeight: '500' }}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
          {hoverData && (
            <span style={{ fontSize: '0.65rem', color: THEME.text.muted }}>
              {new Date(hoverData.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {['7', '30', '90'].map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              padding: '3px 8px', background: timeframe === tf ? THEME.bg.tertiary : 'transparent',
              border: `1px solid ${timeframe === tf ? THEME.border.default : 'transparent'}`,
              borderRadius: '3px', color: timeframe === tf ? THEME.text.primary : THEME.text.muted,
              fontSize: '0.65rem', fontWeight: '500', cursor: 'pointer'
            }}>{tf}D</button>
          ))}
        </div>
      </div>

      {/* Compact chart */}
      <div ref={chartRef} style={{ position: 'relative', width: '100%', height: '60px', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.1" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Subtle grid — single midline */}
          <line x1={0} y1={pad.top + gH * 0.5} x2={W} y2={pad.top + gH * 0.5}
            stroke={THEME.border.subtle} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />

          {/* Area fill — very subtle */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line — thin, no glow */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Hover line */}
          {hoverX !== null && (
            <>
              <line x1={`${hoverX}%`} y1={pad.top} x2={`${hoverX}%`} y2={pad.top + gH}
                stroke={THEME.text.muted} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
              {hoverData && (
                <circle cx={`${hoverX}%`} cy={pad.top + gH - ((hoverData.price - minPrice) / priceRange) * gH}
                  r="3" fill={THEME.bg.secondary} stroke={lineColor} strokeWidth="1.5" />
              )}
            </>
          )}
        </svg>

        {/* Minimal labels */}
        <div style={{ position: 'absolute', right: '2px', top: '0', fontSize: '0.55rem', color: THEME.text.muted, fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>
          ${formatPrice(maxPrice)}
        </div>
        <div style={{ position: 'absolute', right: '2px', bottom: '12px', fontSize: '0.55rem', color: THEME.text.muted, fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>
          ${formatPrice(minPrice)}
        </div>
        <div style={{ position: 'absolute', left: '0', bottom: '0', fontSize: '0.55rem', color: THEME.text.muted, opacity: 0.6 }}>
          {formatDate(chartData[0]?.timestamp)}
        </div>
        <div style={{ position: 'absolute', right: '0', bottom: '0', fontSize: '0.55rem', color: THEME.text.muted, opacity: 0.6 }}>
          {formatDate(chartData[chartData.length - 1]?.timestamp)}
        </div>
      </div>
    </div>
  );
});

PriceChart.displayName = 'PriceChart';
export default PriceChart;
