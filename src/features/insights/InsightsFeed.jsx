import React, { useMemo, useState, memo } from 'react';
import { THEME } from '../../utils/theme.js';
import { SEVERITY, CATEGORY, getCategoryMeta } from './InsightsEngine.js';

// ============================================
// SEVERITY CONFIG
// ============================================

const SEVERITY_CONFIG = {
  [SEVERITY.CRITICAL]: { bg: 'rgba(248, 81, 73, 0.12)', border: 'rgba(248, 81, 73, 0.3)', color: '#f85149', label: 'CRITICAL', dot: '#f85149' },
  [SEVERITY.WARNING]: { bg: 'rgba(210, 153, 34, 0.12)', border: 'rgba(210, 153, 34, 0.3)', color: '#d29922', label: 'WARNING', dot: '#d29922' },
  [SEVERITY.POSITIVE]: { bg: 'rgba(63, 185, 80, 0.12)', border: 'rgba(63, 185, 80, 0.3)', color: '#3fb950', label: 'BULLISH', dot: '#3fb950' },
  [SEVERITY.INFO]: { bg: 'rgba(88, 166, 255, 0.08)', border: 'rgba(88, 166, 255, 0.2)', color: '#58a6ff', label: 'INFO', dot: '#58a6ff' }
};

// ============================================
// SINGLE INSIGHT CARD
// ============================================

const InsightCard = memo(({ insight }) => {
  const sev = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG[SEVERITY.INFO];

  return (
    <div style={{
      background: sev.bg,
      border: `1px solid ${sev.border}`,
      borderRadius: '8px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${sev.border}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Severity dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: sev.dot, marginTop: '6px', flexShrink: 0,
        boxShadow: `0 0 6px ${sev.dot}60`
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: THEME.text.primary, lineHeight: 1.3 }}>
            {insight.title}
          </div>
          {insight.metric && (
            <span style={{
              background: sev.bg,
              border: `1px solid ${sev.border}`,
              color: sev.color,
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {insight.metric}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: THEME.text.secondary, lineHeight: 1.4 }}>
          {insight.message}
        </div>
      </div>
    </div>
  );
});
InsightCard.displayName = 'InsightCard';

// ============================================
// CATEGORY GROUP
// ============================================

const CategoryGroup = memo(({ category, insights }) => {
  const [expanded, setExpanded] = useState(true);
  const meta = getCategoryMeta(category);

  // Highest severity in this group
  const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 };
  const highestSeverity = insights.reduce((best, i) =>
    (severityOrder[i.severity] || 9) < (severityOrder[best] || 9) ? i.severity : best
  , 'info');
  const sevConfig = SEVERITY_CONFIG[highestSeverity] || SEVERITY_CONFIG[SEVERITY.INFO];

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Category header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: THEME.bg.secondary,
          border: `1px solid ${THEME.border.default}`,
          borderRadius: expanded ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          color: THEME.text.primary,
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontSize: '1rem' }}>{meta.icon}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: '600', flex: 1, textAlign: 'left' }}>
          {meta.label}
        </span>
        <span style={{
          background: sevConfig.bg,
          border: `1px solid ${sevConfig.border}`,
          color: sevConfig.color,
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: '700'
        }}>
          {insights.length} {insights.length === 1 ? 'signal' : 'signals'}
        </span>
        <span style={{
          color: THEME.text.muted,
          fontSize: '0.75rem',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}>▼</span>
      </button>

      {/* Cards */}
      {expanded && (
        <div style={{
          background: THEME.bg.primary,
          border: `1px solid ${THEME.border.default}`,
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {insights.map((insight, i) => (
            <InsightCard key={`${insight.category}-${i}`} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
});
CategoryGroup.displayName = 'CategoryGroup';

// ============================================
// SUMMARY BAR
// ============================================

const SummaryBar = memo(({ insights }) => {
  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, positive: 0, info: 0 };
    insights.forEach(i => { c[i.severity] = (c[i.severity] || 0) + 1; });
    return c;
  }, [insights]);

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginBottom: '16px'
    }}>
      {[
        { key: 'critical', label: 'Critical', config: SEVERITY_CONFIG[SEVERITY.CRITICAL] },
        { key: 'warning', label: 'Warning', config: SEVERITY_CONFIG[SEVERITY.WARNING] },
        { key: 'positive', label: 'Bullish', config: SEVERITY_CONFIG[SEVERITY.POSITIVE] },
        { key: 'info', label: 'Info', config: SEVERITY_CONFIG[SEVERITY.INFO] }
      ].filter(s => counts[s.key] > 0).map(s => (
        <div key={s.key} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: s.config.bg,
          border: `1px solid ${s.config.border}`,
          padding: '6px 12px',
          borderRadius: '6px'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.config.dot, boxShadow: `0 0 4px ${s.config.dot}60` }} />
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: s.config.color }}>
            {counts[s.key]} {s.label}
          </span>
        </div>
      ))}
      {insights.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: THEME.text.muted, padding: '8px 0' }}>
          No signals detected — data may still be loading.
        </div>
      )}
    </div>
  );
});
SummaryBar.displayName = 'SummaryBar';

// ============================================
// MAIN INSIGHTS FEED
// ============================================

const InsightsFeed = memo(({ insights }) => {
  // Group by category, preserving category order
  const grouped = useMemo(() => {
    const categoryOrder = [
      CATEGORY.SMART_MONEY,
      CATEGORY.ACCUMULATION,
      CATEGORY.CONCENTRATION,
      CATEGORY.ANOMALY,
      CATEGORY.VELOCITY,
      CATEGORY.SUPPLY
    ];

    const groups = new Map();
    categoryOrder.forEach(cat => {
      const catInsights = insights.filter(i => i.category === cat);
      if (catInsights.length > 0) {
        groups.set(cat, catInsights);
      }
    });

    // Any uncategorized
    const known = new Set(categoryOrder);
    const other = insights.filter(i => !known.has(i.category));
    if (other.length > 0) groups.set('other', other);

    return groups;
  }, [insights]);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: THEME.text.primary }}>
          Insights
        </h3>
        <span style={{ fontSize: '0.7rem', color: THEME.text.muted }}>
          {insights.length} signals detected
        </span>
      </div>

      {/* Summary badges */}
      <SummaryBar insights={insights} />

      {/* Grouped categories */}
      {Array.from(grouped.entries()).map(([category, catInsights]) => (
        <CategoryGroup
          key={category}
          category={category}
          insights={catInsights}
        />
      ))}
    </div>
  );
});

InsightsFeed.displayName = 'InsightsFeed';

export default InsightsFeed;
