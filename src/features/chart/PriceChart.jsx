import React, { useState, useRef, useMemo, memo, useCallback } from 'react';
import { THEME } from '../../utils/theme.js';
import { formatPrice } from '../../utils/formatters.js';

// ============================================
// PRICE CHART COMPONENT (memoized)
// ============================================

const PriceChart = memo(({ data, timeframe, setTimeframe }) => {
  const [hoverData, setHoverData] = useState(null);
  const [hoverX, setHoverX] = useState(null);
  const chartRef = useRef(null);
  
  // Memoize expensive calculations
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

    // Sample data points for smooth rendering (50-80 points ideal)
    const targetPoints = 60;
    const step = Math.max(1, Math.floor(data.length / targetPoints));
    const chartData = data.filter((_, i) => i % step === 0 || i === data.length - 1);

    return { prices, minPrice, maxPrice, priceRange, currentPrice, startPrice, priceChange, isPositive, chartData };
  }, [data]);

  // Memoize chart path generation (expensive SVG computation)
  const { linePath, areaPath, gradientId, lineColor } = useMemo(() => {
    if (!chartMetrics) return { linePath: '', areaPath: '', gradientId: '', lineColor: '' };
    
    const { minPrice, priceRange, isPositive, chartData } = chartMetrics;
    
    const chartWidth = 400;
    const chartHeight = 140;
    const padding = { top: 10, bottom: 20, left: 0, right: 0 };
    const graphHeight = chartHeight - padding.top - padding.bottom;
    const graphWidth = chartWidth - padding.left - padding.right;

    const generateSmoothPath = (points) => {
      if (points.length < 2) return '';
      
      const getPoint = (i) => {
        const x = padding.left + (i / (points.length - 1)) * graphWidth;
        const y = padding.top + graphHeight - ((points[i].price - minPrice) / priceRange) * graphHeight;
        return { x, y };
      };

      let path = `M ${getPoint(0).x} ${getPoint(0).y}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = getPoint(Math.max(0, i - 1));
        const p1 = getPoint(i);
        const p2 = getPoint(Math.min(points.length - 1, i + 1));
        const p3 = getPoint(Math.min(points.length - 1, i + 2));
        
        const tension = 0.3;
        
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
      
      return path;
    };

    const lPath = generateSmoothPath(chartData);
    const lastPoint = padding.left + graphWidth;
    const firstPoint = padding.left;
    const bottom = padding.top + graphHeight;
    const aPath = `${lPath} L ${lastPoint} ${bottom} L ${firstPoint} ${bottom} Z`;
    const gId = `priceGradient_${isPositive ? 'up' : 'down'}`;
    const lColor = isPositive ? THEME.accent.success : THEME.accent.error;

    return { linePath: lPath, areaPath: aPath, gradientId: gId, lineColor: lColor };
  }, [chartMetrics]);

  const handleMouseMove = useCallback((e) => {
    if (!chartRef.current || !chartMetrics) return;
    
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relativeX = x / rect.width;
    
    const { chartData } = chartMetrics;
    const index = Math.min(
      Math.max(0, Math.round(relativeX * (chartData.length - 1))),
      chartData.length - 1
    );
    
    const dataPoint = chartData[index];
    if (dataPoint) {
      setHoverData(dataPoint);
      setHoverX(relativeX * 100);
    }
  }, [chartMetrics]);

  const handleMouseLeave = useCallback(() => {
    setHoverData(null);
    setHoverX(null);
  }, []);

  if (!chartMetrics) {
    return (
      <div style={{
        background: THEME.bg.secondary,
        border: `1px solid ${THEME.border.default}`,
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        color: THEME.text.muted
      }}>
        No price data available
      </div>
    );
  }

  const { minPrice, maxPrice, priceRange, currentPrice, priceChange, isPositive, chartData } = chartMetrics;

  const chartWidth = 400;
  const chartHeight = 140;
  const padding = { top: 10, bottom: 20, left: 0, right: 0 };
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const graphWidth = chartWidth - padding.left - padding.right;

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{
      background: THEME.bg.secondary,
      border: `1px solid ${THEME.border.default}`,
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '24px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: THEME.text.primary, fontVariantNumeric: 'tabular-nums' }}>
            ${formatPrice(hoverData?.price || currentPrice)}
          </div>
          <div style={{ fontSize: '0.8rem', color: isPositive ? THEME.accent.success : THEME.accent.error, fontWeight: '500' }}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}% · {timeframe}d
          </div>
          {hoverData && (
            <div style={{ fontSize: '0.7rem', color: THEME.text.muted, marginTop: '2px' }}>
              {new Date(hoverData.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['7', '30', '90'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '5px 10px',
                background: timeframe === tf ? THEME.bg.tertiary : 'transparent',
                border: `1px solid ${timeframe === tf ? THEME.border.default : 'transparent'}`,
                borderRadius: '4px',
                color: timeframe === tf ? THEME.text.primary : THEME.text.muted,
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {tf}D
            </button>
          ))}
        </div>
      </div>
      
      {/* Chart */}
      <div
        ref={chartRef}
        style={{ position: 'relative', width: '100%', aspectRatio: `${chartWidth}/${chartHeight + 20}`, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + graphHeight * ratio}
              x2={padding.left + graphWidth}
              y2={padding.top + graphHeight * ratio}
              stroke={THEME.border.subtle}
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.5"
            />
          ))}
          
          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          
          {/* Main line with glow */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          
          {/* Hover vertical line */}
          {hoverX !== null && (
            <>
              <line
                x1={`${hoverX}%`}
                y1={padding.top}
                x2={`${hoverX}%`}
                y2={padding.top + graphHeight}
                stroke={THEME.text.muted}
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              {hoverData && (
                <circle
                  cx={`${hoverX}%`}
                  cy={padding.top + graphHeight - ((hoverData.price - minPrice) / priceRange) * graphHeight}
                  r="5"
                  fill={THEME.bg.secondary}
                  stroke={lineColor}
                  strokeWidth="2"
                />
              )}
            </>
          )}
        </svg>
        
        {/* Price range labels */}
        <div style={{ position: 'absolute', right: '4px', top: `${padding.top}px`, fontSize: '0.65rem', color: THEME.text.muted, fontVariantNumeric: 'tabular-nums' }}>
          ${formatPrice(maxPrice)}
        </div>
        <div style={{ position: 'absolute', right: '4px', bottom: `${padding.bottom + 4}px`, fontSize: '0.65rem', color: THEME.text.muted, fontVariantNumeric: 'tabular-nums' }}>
          ${formatPrice(minPrice)}
        </div>
        
        {/* Time labels */}
        <div style={{ position: 'absolute', left: '0', bottom: '0', fontSize: '0.65rem', color: THEME.text.muted }}>
          {formatDate(chartData[0]?.timestamp)}
        </div>
        <div style={{ position: 'absolute', right: '0', bottom: '0', fontSize: '0.65rem', color: THEME.text.muted }}>
          {formatDate(chartData[chartData.length - 1]?.timestamp)}
        </div>
      </div>
    </div>
  );
});

PriceChart.displayName = 'PriceChart';

export default PriceChart;
