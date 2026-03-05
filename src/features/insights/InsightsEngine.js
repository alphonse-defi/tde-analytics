// ============================================
// INSIGHTS ENGINE - Edge Analytics v15
// Pure computation: data in → insight objects out
// Categories: Accumulation/Distribution, Concentration,
//   Smart Money, Anomaly, Holder Velocity, Supply Pressure
// Threshold: Balanced
// ============================================

// Severity levels
export const SEVERITY = {
  CRITICAL: 'critical',   // Immediate attention (red)
  WARNING: 'warning',     // Notable move (amber)
  INFO: 'info',           // Worth knowing (blue)
  POSITIVE: 'positive'    // Bullish signal (green)
};

// Category identifiers
export const CATEGORY = {
  ACCUMULATION: 'accumulation',
  CONCENTRATION: 'concentration',
  SMART_MONEY: 'smart_money',
  ANOMALY: 'anomaly',
  VELOCITY: 'velocity',
  SUPPLY: 'supply'
};

const CATEGORY_META = {
  [CATEGORY.ACCUMULATION]: { label: 'Accumulation / Distribution', icon: '📊', color: '#58a6ff' },
  [CATEGORY.CONCENTRATION]: { label: 'Concentration', icon: '🎯', color: '#d29922' },
  [CATEGORY.SMART_MONEY]: { label: 'Smart Money', icon: '🧠', color: '#a855f7' },
  [CATEGORY.ANOMALY]: { label: 'Anomaly Detection', icon: '⚡', color: '#f97316' },
  [CATEGORY.VELOCITY]: { label: 'Holder Velocity', icon: '⏱️', color: '#06b6d4' },
  [CATEGORY.SUPPLY]: { label: 'Supply Pressure', icon: '📦', color: '#ec4899' }
};

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || { label: category, icon: '📌', color: '#8b949e' };
}

// ============================================
// MAIN ENGINE: Run all detectors on current state
// ============================================

export function generateInsights(state) {
  const {
    holders = [],
    previousHolders = {},
    snapshotComparison = {},
    tokenInfo = null,
    tokenPrice = 0,
    transfers = [],
    poolsData = [],
    priceHistory = [],
    smHolders = [],
    flowData = [],
    whoBoughtSold = null
  } = state;

  const insights = [];

  // Run each detector
  insights.push(...detectAccumulation(holders, previousHolders, snapshotComparison, transfers, poolsData));
  insights.push(...detectConcentration(holders, snapshotComparison));
  insights.push(...detectSmartMoney(smHolders, flowData, whoBoughtSold));
  insights.push(...detectAnomalies(holders, transfers, snapshotComparison, tokenPrice));
  insights.push(...detectVelocity(holders, smHolders, transfers));
  insights.push(...detectSupplyPressure(tokenInfo, holders, priceHistory));

  // Sort: critical first, then by category
  const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 };
  insights.sort((a, b) => (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9));

  return insights;
}

// ============================================
// 1. ACCUMULATION / DISTRIBUTION
// ============================================

function detectAccumulation(holders, previousHolders, comparison, transfers, pools) {
  const insights = [];
  if (!holders || holders.length === 0) return insights;

  // Holder count change
  const newCount = comparison.newWhales?.length || 0;
  const exitedCount = comparison.exitedWhales?.length || 0;
  const netChange = newCount - exitedCount;

  if (netChange >= 3) {
    insights.push({
      category: CATEGORY.ACCUMULATION, severity: SEVERITY.POSITIVE,
      title: 'New holders entering top positions',
      message: `${newCount} new addresses entered the top holder list, ${exitedCount} exited. Net +${netChange} top holders.`,
      metric: `+${netChange} net`
    });
  } else if (netChange <= -3) {
    insights.push({
      category: CATEGORY.ACCUMULATION, severity: SEVERITY.WARNING,
      title: 'Top holders exiting positions',
      message: `${exitedCount} addresses left the top holder list, only ${newCount} new entrants. Net ${netChange} top holders.`,
      metric: `${netChange} net`
    });
  }

  // Top-10 balance trend direction
  const top10 = holders.slice(0, 10);
  let accumulating = 0;
  let distributing = 0;
  top10.forEach(h => {
    const change = comparison.changes?.[h.owner_address];
    if (change) {
      if (change.changePercent > 1) accumulating++;
      else if (change.changePercent < -1) distributing++;
    }
  });

  if (accumulating >= 5) {
    insights.push({
      category: CATEGORY.ACCUMULATION, severity: SEVERITY.POSITIVE,
      title: 'Top-10 holders accumulating',
      message: `${accumulating} of the top 10 holders increased their positions since last snapshot.`,
      metric: `${accumulating}/10 buying`
    });
  } else if (distributing >= 5) {
    insights.push({
      category: CATEGORY.ACCUMULATION, severity: SEVERITY.CRITICAL,
      title: 'Top-10 holders distributing',
      message: `${distributing} of the top 10 holders reduced their positions since last snapshot.`,
      metric: `${distributing}/10 selling`
    });
  }

  // Buy/sell volume ratio from transfers
  if (transfers.length > 0) {
    const buys = transfers.filter(t => t.type === 'buy');
    const sells = transfers.filter(t => t.type === 'sell');
    const buyVol = buys.reduce((s, t) => s + (t.usdValue || 0), 0);
    const sellVol = sells.reduce((s, t) => s + (t.usdValue || 0), 0);
    const total = buyVol + sellVol;

    if (total > 0) {
      const buyRatio = buyVol / total;
      if (buyRatio > 0.65) {
        insights.push({
          category: CATEGORY.ACCUMULATION, severity: SEVERITY.POSITIVE,
          title: 'Strong buy pressure',
          message: `Buy volume is ${(buyRatio * 100).toFixed(0)}% of total DEX volume — buyers dominating.`,
          metric: `${(buyRatio * 100).toFixed(0)}% buys`
        });
      } else if (buyRatio < 0.35) {
        insights.push({
          category: CATEGORY.ACCUMULATION, severity: SEVERITY.WARNING,
          title: 'Heavy sell pressure',
          message: `Sell volume is ${((1 - buyRatio) * 100).toFixed(0)}% of total DEX volume — sellers dominating.`,
          metric: `${((1 - buyRatio) * 100).toFixed(0)}% sells`
        });
      }
    }
  }

  return insights;
}

// ============================================
// 2. CONCENTRATION
// ============================================

function detectConcentration(holders, comparison) {
  const insights = [];
  if (!holders || holders.length === 0) return insights;

  // Top-10 share
  const top10Pct = holders.slice(0, 10).reduce((sum, h) =>
    sum + (parseFloat(h.percentage_relative_to_total_supply) || 0), 0);

  if (top10Pct > 70) {
    insights.push({
      category: CATEGORY.CONCENTRATION, severity: SEVERITY.CRITICAL,
      title: 'Top 10 control >70% of supply',
      message: `The top 10 holders control ${top10Pct.toFixed(1)}% of total supply — extreme concentration risk.`,
      metric: `${top10Pct.toFixed(1)}%`
    });
  } else if (top10Pct > 50) {
    insights.push({
      category: CATEGORY.CONCENTRATION, severity: SEVERITY.WARNING,
      title: 'Top 10 control majority of supply',
      message: `The top 10 holders control ${top10Pct.toFixed(1)}% of total supply.`,
      metric: `${top10Pct.toFixed(1)}%`
    });
  }

  // New entrants to top holders with large positions
  const newWhales = comparison.newWhales || [];
  if (newWhales.length >= 2) {
    insights.push({
      category: CATEGORY.CONCENTRATION, severity: SEVERITY.INFO,
      title: 'New entrants in top holders',
      message: `${newWhales.length} new addresses appeared in the top holder list since last snapshot.`,
      metric: `${newWhales.length} new`
    });
  }

  // Large individual share shifts
  const changes = comparison.changes || {};
  const bigShifts = Object.entries(changes).filter(([, c]) => Math.abs(c.changePercent) > 20);
  if (bigShifts.length > 0) {
    const biggest = bigShifts.sort((a, b) => Math.abs(b[1].changePercent) - Math.abs(a[1].changePercent))[0];
    const [addr, change] = biggest;
    const direction = change.changePercent > 0 ? 'increased' : 'decreased';
    insights.push({
      category: CATEGORY.CONCENTRATION, severity: change.changePercent > 0 ? SEVERITY.INFO : SEVERITY.WARNING,
      title: `Major position ${direction === 'increased' ? 'increase' : 'decrease'}`,
      message: `${addr.slice(0, 8)}... ${direction} position by ${Math.abs(change.changePercent).toFixed(1)}%.`,
      metric: `${change.changePercent > 0 ? '+' : ''}${change.changePercent.toFixed(1)}%`
    });
  }

  return insights;
}

// ============================================
// 3. SMART MONEY
// ============================================

function detectSmartMoney(smHolders, flowData, whoBoughtSold) {
  const insights = [];

  // SM holder presence
  if (smHolders.length > 0) {
    const fundCount = smHolders.filter(h => h.entity_type === 'fund').length;
    const traderCount = smHolders.filter(h => h.entity_type === 'smart_trader').length;

    if (fundCount >= 3) {
      insights.push({
        category: CATEGORY.SMART_MONEY, severity: SEVERITY.POSITIVE,
        title: 'Multiple funds holding',
        message: `${fundCount} identified funds are holding this token.`,
        metric: `${fundCount} funds`
      });
    }

    if (traderCount >= 5) {
      insights.push({
        category: CATEGORY.SMART_MONEY, severity: SEVERITY.INFO,
        title: 'Smart trader interest',
        message: `${traderCount} labeled smart traders hold positions.`,
        metric: `${traderCount} traders`
      });
    }
  }

  // Flow-based SM accumulation streak
  if (flowData.length >= 3) {
    let consecutiveNetPositive = 0;
    for (let i = flowData.length - 1; i >= 0; i--) {
      if (flowData[i].total_inflows > flowData[i].total_outflows) consecutiveNetPositive++;
      else break;
    }

    if (consecutiveNetPositive >= 5) {
      insights.push({
        category: CATEGORY.SMART_MONEY, severity: SEVERITY.POSITIVE,
        title: 'SM accumulation streak',
        message: `Smart Money has been net buying for ${consecutiveNetPositive} consecutive periods.`,
        metric: `${consecutiveNetPositive} periods`
      });
    } else if (consecutiveNetPositive === 0 && flowData.length >= 3) {
      let consecutiveNetNegative = 0;
      for (let i = flowData.length - 1; i >= 0; i--) {
        if (flowData[i].total_outflows > flowData[i].total_inflows) consecutiveNetNegative++;
        else break;
      }
      if (consecutiveNetNegative >= 5) {
        insights.push({
          category: CATEGORY.SMART_MONEY, severity: SEVERITY.CRITICAL,
          title: 'SM distribution streak',
          message: `Smart Money has been net selling for ${consecutiveNetNegative} consecutive periods.`,
          metric: `${consecutiveNetNegative} periods`
        });
      }
    }
  }

  // Cross-entity divergence from whoBoughtSold
  if (whoBoughtSold) {
    const { buyers, sellers } = whoBoughtSold;
    const smBuying = buyers.some(b => b.entity_type === 'smart_money');
    const exchangeInflow = sellers.some(s => s.entity_type === 'exchange');
    const whaleSelling = sellers.some(s => s.entity_type === 'whale');

    if (smBuying && exchangeInflow) {
      insights.push({
        category: CATEGORY.SMART_MONEY, severity: SEVERITY.WARNING,
        title: 'SM buying, exchanges receiving',
        message: 'Smart Money is accumulating while exchange wallets see net inflows — possible distribution by other holders via CEXes.',
        metric: 'Divergence'
      });
    }

    if (smBuying && whaleSelling) {
      insights.push({
        category: CATEGORY.SMART_MONEY, severity: SEVERITY.INFO,
        title: 'Fund/SM vs Whale divergence',
        message: 'Funds and smart traders are buying while whales are net selling — watch for trend direction.',
        metric: 'Divergent'
      });
    }
  }

  return insights;
}

// ============================================
// 4. ANOMALY DETECTION
// ============================================

function detectAnomalies(holders, transfers, comparison, tokenPrice) {
  const insights = [];

  // Unusual transfer sizes
  if (transfers.length >= 10) {
    const usdValues = transfers.map(t => t.usdValue || 0).filter(v => v > 0);
    if (usdValues.length >= 5) {
      const sorted = [...usdValues].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const largest = sorted[sorted.length - 1];

      // If the largest is >10x the median, flag it
      if (median > 0 && largest > median * 10) {
        const formatter = (v) => {
          if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
          if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
          return `$${v.toFixed(0)}`;
        };
        insights.push({
          category: CATEGORY.ANOMALY, severity: SEVERITY.WARNING,
          title: 'Unusually large transfer detected',
          message: `Largest recent transfer (${formatter(largest)}) is ${(largest / median).toFixed(0)}x the median transfer size (${formatter(median)}).`,
          metric: `${(largest / median).toFixed(0)}x median`
        });
      }
    }
  }

  // Rapid holder changes (many simultaneous entries/exits)
  const newCount = comparison.newWhales?.length || 0;
  const exitedCount = comparison.exitedWhales?.length || 0;
  const totalChurn = newCount + exitedCount;

  if (holders.length > 0 && totalChurn > holders.length * 0.15) {
    insights.push({
      category: CATEGORY.ANOMALY, severity: SEVERITY.WARNING,
      title: 'High holder turnover',
      message: `${totalChurn} top-holder position changes since last snapshot (${newCount} entries, ${exitedCount} exits) — ${((totalChurn / holders.length) * 100).toFixed(0)}% of holder list.`,
      metric: `${totalChurn} changes`
    });
  }

  // Large balance swings (>50% change in a single holder)
  const changes = comparison.changes || {};
  const extremeChanges = Object.entries(changes).filter(([, c]) => Math.abs(c.changePercent) > 50);
  if (extremeChanges.length > 0) {
    insights.push({
      category: CATEGORY.ANOMALY, severity: SEVERITY.CRITICAL,
      title: `${extremeChanges.length} holder(s) with >50% balance change`,
      message: `${extremeChanges.length} top holder address(es) changed their balance by more than 50% since last snapshot — possible accumulation or exit.`,
      metric: `${extremeChanges.length} wallets`
    });
  }

  return insights;
}

// ============================================
// 5. HOLDER VELOCITY
// ============================================

function detectVelocity(holders, smHolders, transfers) {
  const insights = [];

  // Compute turnover from inflow/outflow data on SM holders
  if (smHolders.length > 0) {
    const withFlows = smHolders.filter(h => (h.total_inflow || 0) > 0 || (h.total_outflow || 0) > 0);
    if (withFlows.length >= 3) {
      let highTurnover = 0;
      let lowTurnover = 0;

      withFlows.forEach(h => {
        const balance = parseFloat(h.balance_formatted || h.balance) || 0;
        const totalFlow = (h.total_inflow || 0) + (h.total_outflow || 0);
        if (balance > 0) {
          const turnoverRatio = totalFlow / balance;
          if (turnoverRatio > 2) highTurnover++;
          else if (turnoverRatio < 0.1) lowTurnover++;
        }
      });

      if (highTurnover > withFlows.length * 0.5) {
        insights.push({
          category: CATEGORY.VELOCITY, severity: SEVERITY.WARNING,
          title: 'High SM turnover — speculative activity',
          message: `${highTurnover} of ${withFlows.length} smart money holders show high turnover (total flows > 2x balance) — suggests trading, not conviction holding.`,
          metric: `${highTurnover}/${withFlows.length} active`
        });
      } else if (lowTurnover > withFlows.length * 0.5) {
        insights.push({
          category: CATEGORY.VELOCITY, severity: SEVERITY.POSITIVE,
          title: 'Low SM turnover — conviction holding',
          message: `${lowTurnover} of ${withFlows.length} smart money holders show minimal trading activity — suggests strong conviction.`,
          metric: `${lowTurnover}/${withFlows.length} HODLing`
        });
      }
    }
  }

  // Transfer frequency trend
  if (transfers.length >= 20) {
    const recentHalf = transfers.slice(0, Math.floor(transfers.length / 2));
    const olderHalf = transfers.slice(Math.floor(transfers.length / 2));
    const recentAvgValue = recentHalf.reduce((s, t) => s + (t.usdValue || 0), 0) / recentHalf.length;
    const olderAvgValue = olderHalf.reduce((s, t) => s + (t.usdValue || 0), 0) / olderHalf.length;

    if (olderAvgValue > 0) {
      const changeRatio = recentAvgValue / olderAvgValue;
      if (changeRatio > 2) {
        insights.push({
          category: CATEGORY.VELOCITY, severity: SEVERITY.INFO,
          title: 'Transaction size increasing',
          message: `Recent average transaction size is ${changeRatio.toFixed(1)}x larger than earlier transactions — larger players entering.`,
          metric: `${changeRatio.toFixed(1)}x avg`
        });
      } else if (changeRatio < 0.5) {
        insights.push({
          category: CATEGORY.VELOCITY, severity: SEVERITY.INFO,
          title: 'Transaction size decreasing',
          message: `Recent transactions average ${((1 - changeRatio) * 100).toFixed(0)}% smaller than earlier — large players may be done.`,
          metric: `${(changeRatio * 100).toFixed(0)}% of prev`
        });
      }
    }
  }

  return insights;
}

// ============================================
// 6. SUPPLY PRESSURE
// ============================================

function detectSupplyPressure(tokenInfo, holders, priceHistory) {
  const insights = [];
  if (!tokenInfo) return insights;

  // Circulating vs total supply gap
  const circulating = tokenInfo.circulating_supply || 0;
  const total = tokenInfo.total_supply || 0;

  if (circulating > 0 && total > 0) {
    const unlockedPct = (circulating / total) * 100;
    const lockedPct = 100 - unlockedPct;

    if (lockedPct > 50) {
      insights.push({
        category: CATEGORY.SUPPLY, severity: SEVERITY.WARNING,
        title: 'Large supply still locked',
        message: `Only ${unlockedPct.toFixed(1)}% of total supply is circulating — ${lockedPct.toFixed(1)}% is locked/unvested, representing future sell pressure.`,
        metric: `${lockedPct.toFixed(0)}% locked`
      });
    } else if (lockedPct > 25) {
      insights.push({
        category: CATEGORY.SUPPLY, severity: SEVERITY.INFO,
        title: 'Notable locked supply',
        message: `${lockedPct.toFixed(1)}% of total supply is not yet circulating.`,
        metric: `${lockedPct.toFixed(0)}% locked`
      });
    }

    // FDV to market cap ratio (dilution risk)
    const fdv = tokenInfo.fully_diluted_valuation || 0;
    const mcap = tokenInfo.market_cap || 0;
    if (fdv > 0 && mcap > 0) {
      const dilutionRatio = fdv / mcap;
      if (dilutionRatio > 5) {
        insights.push({
          category: CATEGORY.SUPPLY, severity: SEVERITY.CRITICAL,
          title: 'Extreme dilution risk',
          message: `FDV is ${dilutionRatio.toFixed(1)}x market cap — massive potential supply dilution ahead.`,
          metric: `${dilutionRatio.toFixed(1)}x FDV/MC`
        });
      } else if (dilutionRatio > 2) {
        insights.push({
          category: CATEGORY.SUPPLY, severity: SEVERITY.WARNING,
          title: 'Significant dilution risk',
          message: `FDV is ${dilutionRatio.toFixed(1)}x market cap — notable future dilution potential.`,
          metric: `${dilutionRatio.toFixed(1)}x FDV/MC`
        });
      }
    }
  }

  // Price trend vs holder accumulation divergence
  if (priceHistory.length >= 5 && holders.length > 0) {
    const recentPrices = priceHistory.slice(-5);
    const priceStart = recentPrices[0]?.price || 0;
    const priceEnd = recentPrices[recentPrices.length - 1]?.price || 0;
    const priceChange = priceStart > 0 ? ((priceEnd - priceStart) / priceStart) * 100 : 0;

    // If price is down but top holders are accumulating
    if (priceChange < -5) {
      const top10 = holders.slice(0, 10);
      const top10Accumulated = top10.filter(h => {
        const balance = parseFloat(h.balance_formatted || h.balance) || 0;
        return balance > 0 && (h.balance_change_24h > 0 || h.total_inflow > h.total_outflow);
      }).length;

      if (top10Accumulated >= 5) {
        insights.push({
          category: CATEGORY.SUPPLY, severity: SEVERITY.POSITIVE,
          title: 'Price down but top holders accumulating',
          message: `Price is down ${Math.abs(priceChange).toFixed(1)}% but ${top10Accumulated}/10 top holders are increasing positions — potential dip buying.`,
          metric: `${top10Accumulated}/10 buying dip`
        });
      }
    }
  }

  return insights;
}
