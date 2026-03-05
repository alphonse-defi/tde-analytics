import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';

// ============================================
// SPLIT MODULE IMPORTS (v14 refactor)
// ============================================
import { THEME } from './utils/theme.js';
import { SNAPSHOT_INTERVAL, MARKET_REFRESH_INTERVAL, TOKENS_PER_PAGE, TRANSACTIONS_PER_PAGE, WHALE_CHANGE_THRESHOLD, NETWORKS, COINGECKO_PLATFORM_MAP } from './utils/constants.js';
import { formatNumber, formatUSD, formatLargeUSD, formatPercent, shortenAddress, formatTimeRemaining, formatTimeAgo, formatPrice } from './utils/formatters.js';
import { SnapshotManager } from './services/storage.js';
import { fetchFromMoralis, fetchFromCoinGecko, fetchFromGeckoTerminal, getCoinGeckoDetail, extractPlatforms, canFetchFromMoralis } from './services/api.js';
import { getTokenHolders, getTokenFlows, getWhoBoughtSold } from './services/nansen.js';
import { useAbortController } from './utils/hooks.js';
import { CopyButton, AddressDisplay, NetworkBadge, LoadingSpinner, Pagination, TransactionFilters, SocialLinks, StatCard } from './components/shared.jsx';
import PriceChart from './features/chart/PriceChart.jsx';
import TokenMetricsCard from './features/chart/TokenMetricsCard.jsx';
import HolderDistributionChart from './features/holders/HolderDistributionChart.jsx';
import PoolsTable from './features/holders/PoolsTable.jsx';
import SmartMoneyTab from './features/smartmoney/SmartMoneyTab.jsx';
import { generateInsights } from './features/insights/InsightsEngine.js';
import InsightsFeed from './features/insights/InsightsFeed.jsx';
import MarketInsights from './features/insights/MarketInsights.jsx';

// ============================================
// WALLET PROFILER MODAL (kept inline)
// ============================================

// ============================================
// PHASE 4: WALLET PROFILER MODAL
// ============================================

const WalletProfiler = ({ wallet, walletData, loading, onClose, chain }) => {
  if (!wallet) return null;
  const network = NETWORKS[chain] || NETWORKS.eth;
  const formatUSD = (v) => {
    if (!v) return '$0';
    if (v >= 1e9) return `$${(v/1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v/1e3).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };
  const topHoldings = walletData?.portfolio?.slice(0, 15) || [];
  const totalValue = walletData?.total_value || 0;
  const chainBreakdown = walletData?.chain_breakdown || [];
  const isMultiChain = walletData?.multiChain;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: THEME.bg.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${THEME.border.default}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: THEME.bg.secondary, zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Wallet Profile
              {isMultiChain && <span style={{ fontSize: '0.7rem', background: THEME.bg.tertiary, border: `1px solid ${THEME.border.default}`, padding: '2px 8px', borderRadius: '4px', color: THEME.text.secondary }}>Multi-Chain</span>}
            </h2>
            <a href={`${network.explorer}/address/${wallet}`} target="_blank" rel="noopener noreferrer" style={{ color: THEME.accent.secondary, fontSize: '0.75rem', textDecoration: 'none' }}>
              {wallet.slice(0, 10)}...{wallet.slice(-8)} ↗
            </a>
          </div>
          <button onClick={onClose} style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.border.default}`, borderRadius: '6px', color: THEME.text.secondary, padding: '6px 12px', cursor: 'pointer', fontSize: '0.875rem' }}>Close</button>
        </div>
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: THEME.text.secondary }}><LoadingSpinner size={24} /><div style={{ marginTop: '12px' }}>Loading...</div></div>
          ) : walletData ? (
            <>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>Total Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: THEME.accent.success }}>{formatUSD(totalValue)}</div>
                </div>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>Tokens</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>{walletData.token_count || 0}</div>
                </div>
                <div style={{ background: THEME.bg.tertiary, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>Chains</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>{chainBreakdown.length || 1}</div>
                </div>
              </div>

              {/* Chain Breakdown */}
              {isMultiChain && chainBreakdown.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', fontWeight: '600', color: '#fff' }}>Value by Chain</h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {chainBreakdown.sort((a, b) => b.value - a.value).map((c, i) => {
                      const pct = totalValue > 0 ? (c.value / totalValue * 100) : 0;
                      return (
                        <div key={i} style={{
                          background: THEME.bg.tertiary,
                          border: `1px solid ${THEME.border.default}`,
                          borderRadius: '6px',
                          padding: '10px 14px',
                          minWidth: '100px'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: THEME.text.secondary }}>{c.name}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>{formatUSD(c.value)}</div>
                          <div style={{ fontSize: '0.65rem', color: '#888' }}>{pct.toFixed(1)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Holdings */}
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', fontWeight: '600', color: '#fff' }}>Top Holdings</h3>
              <div style={{ background: THEME.bg.tertiary, borderRadius: '8px', overflow: 'hidden' }}>
                {topHoldings.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${THEME.border.default}` }}>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#888', fontWeight: '500' }}>Token</th>
                      {isMultiChain && <th style={{ padding: '10px', textAlign: 'left', color: '#888', fontWeight: '500' }}>Chains</th>}
                      <th style={{ padding: '10px', textAlign: 'right', color: '#888', fontWeight: '500' }}>Balance</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: '#888', fontWeight: '500' }}>Value</th>
                    </tr></thead>
                    <tbody>
                      {topHoldings.map((t, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${THEME.border.subtle}` }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {t.logo && <img src={t.logo} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} onError={e => e.target.style.display='none'} />}
                              <div><div style={{ fontWeight: '500', color: '#fff' }}>{t.symbol}</div><div style={{ fontSize: '0.7rem', color: '#888' }}>{t.name?.slice(0, 18)}</div></div>
                            </div>
                          </td>
                          {isMultiChain && (
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {(t.chains || []).map((c, ci) => (
                                  <span key={ci} style={{
                                    background: `${NETWORKS[c]?.color || '#666'}30`,
                                    color: NETWORKS[c]?.color || '#888',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.6rem',
                                    fontWeight: '600'
                                  }}>
                                    {NETWORKS[c]?.name?.slice(0, 3) || c}
                                  </span>
                                ))}
                              </div>
                            </td>
                          )}
                          <td style={{ padding: '12px', textAlign: 'right', color: '#fff' }}>{t.balance?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>{formatUSD(t.usd_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No tokens found</div>}
              </div>
            </>
          ) : <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Failed to load wallet data</div>}
        </div>
      </div>
    </div>
  );
};

// ============================================
// WALLET TRACKER VIEW (kept inline)
// ============================================

// ============================================
// PHASE 4: WALLET TRACKER VIEW
// ============================================

const WalletTrackerView = ({ onSelectWallet }) => {
  const [walletSearch, setWalletSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState('eth');
  const [trackedWallets, setTrackedWallets] = useState(() => {
    const saved = localStorage.getItem('trackedWallets');
    return saved ? JSON.parse(saved) : [];
  });
  const [topTraders, setTopTraders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Save tracked wallets to localStorage
  useEffect(() => {
    localStorage.setItem('trackedWallets', JSON.stringify(trackedWallets));
  }, [trackedWallets]);

  const handleAddWallet = () => {
    if (!walletSearch) return;
    
    // Validate address format
    const isValid = walletSearch.startsWith('0x') 
      ? walletSearch.length === 42 
      : walletSearch.length >= 32 && walletSearch.length <= 44;
    
    if (!isValid) {
      alert('Invalid wallet address');
      return;
    }

    const chain = walletSearch.startsWith('0x') ? selectedChain : 'solana';
    
    const exists = trackedWallets.some(w => 
      w.address.toLowerCase() === walletSearch.toLowerCase()
    );
    
    if (!exists) {
      setTrackedWallets([...trackedWallets, {
        address: walletSearch,
        chain,
        addedAt: new Date().toISOString(),
        label: ''
      }]);
    }
    setWalletSearch('');
  };

  const handleRemoveWallet = (address) => {
    setTrackedWallets(trackedWallets.filter(w => w.address !== address));
  };

  const formatUSD = (v) => {
    if (!v) return '$0';
    if (v >= 1e9) return `$${(v/1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v/1e3).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Add Wallet Section */}
      <div style={{
        background: THEME.bg.secondary,
        border: `1px solid ${THEME.border.default}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
          Track Wallets
        </h2>
        <p style={{ color: THEME.text.secondary, fontSize: '0.8rem', marginBottom: '16px' }}>
          Add wallet addresses to track holdings and activity across chains.
        </p>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={walletSearch}
            onChange={(e) => setWalletSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddWallet()}
            placeholder="Enter wallet address (0x... or Solana)"
            style={{
              flex: 1,
              minWidth: '280px',
              padding: '10px 14px',
              background: THEME.bg.primary,
              border: `1px solid ${THEME.border.default}`,
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            style={{
              padding: '10px 14px',
              background: THEME.bg.primary,
              border: `1px solid ${THEME.border.default}`,
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            {Object.entries(NETWORKS).map(([key, net]) => (
              <option key={key} value={key}>{net.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddWallet}
            style={{
              padding: '10px 20px',
              background: THEME.accent.primary,
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.8125rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Add Wallet
          </button>
        </div>
      </div>

      {/* Tracked Wallets */}
      {trackedWallets.length > 0 && (
        <div style={{
          background: THEME.bg.secondary,
          border: `1px solid ${THEME.border.default}`,
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9375rem', fontWeight: '600', color: '#fff' }}>
            Tracked Wallets ({trackedWallets.length})
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {trackedWallets.map((wallet, idx) => {
              const network = NETWORKS[wallet.chain] || NETWORKS.eth;
              return (
                <div
                  key={wallet.address}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: THEME.bg.tertiary,
                    borderRadius: '6px',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <span style={{
                      background: THEME.bg.secondary,
                      color: THEME.text.secondary,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                      border: `1px solid ${THEME.border.default}`
                    }}>
                      {network.name}
                    </span>
                    <span
                      onClick={() => onSelectWallet(wallet.address, wallet.chain)}
                      style={{
                        fontFamily: 'monospace',
                        color: THEME.accent.secondary,
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <a
                      href={`${network.explorer}/address/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '5px 10px',
                        background: THEME.bg.secondary,
                        border: `1px solid ${THEME.border.default}`,
                        borderRadius: '4px',
                        color: THEME.text.secondary,
                        fontSize: '0.75rem',
                        textDecoration: 'none'
                      }}
                    >
                      Explorer ↗
                    </a>
                    <button
                      onClick={() => handleRemoveWallet(wallet.address)}
                      style={{
                        padding: '5px 10px',
                        background: THEME.bg.secondary,
                        border: `1px solid ${THEME.border.default}`,
                        borderRadius: '4px',
                        color: THEME.accent.error,
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div style={{
        background: 'rgba(123, 47, 247, 0.1)',
        border: '1px solid rgba(123, 47, 247, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#a855f7' }}>
          🚀 Coming Soon: Top Traders Leaderboard
        </h3>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
          Track the most profitable traders based on PnL and portfolio performance. 
          This feature requires additional API integration for historical trade data.
        </p>
      </div>

      {/* Empty State */}
      {trackedWallets.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#888'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👛</div>
          <h3 style={{ color: '#fff', marginBottom: '8px' }}>No Wallets Tracked Yet</h3>
          <p>Add a wallet address above to start tracking holdings and activity.</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// TOKEN ROW COMPONENT (kept inline, memoized)
// ============================================

// ============================================
// TOKEN ROW COMPONENT (for market overview)
// ============================================

const TokenRow = ({ token, rank, onTrack, isTracked }) => {
  const priceChange = parseFloat(token.price_change_percentage_24h || 0) || 0;
  const isPositive = priceChange >= 0;
  
  // Determine network from platforms data if available
  // CoinGecko markets endpoint aggregates across chains
  let networkKey = null;
  let multiChain = false;
  
  if (token.platforms && Object.keys(token.platforms).length > 0) {
    const supportedPlatforms = Object.entries(token.platforms)
      .filter(([platform, address]) => address && COINGECKO_PLATFORM_MAP[platform]);
    
    if (supportedPlatforms.length > 1) {
      multiChain = true;
    } else if (supportedPlatforms.length === 1) {
      networkKey = COINGECKO_PLATFORM_MAP[supportedPlatforms[0][0]];
    }
  }
  
  // Default to multi-chain since CoinGecko aggregates data
  if (!networkKey && !multiChain) {
    multiChain = true;
  }
  
  return (
    <tr
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        transition: 'background 0.2s ease'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Rank */}
      <td style={{ padding: '12px 16px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          background: rank <= 3 
            ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)'
            : 'rgba(255,255,255,0.1)',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '700',
          color: rank <= 3 ? '#000' : '#888'
        }}>
          {rank}
        </span>
      </td>

      {/* Token */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {token.image && (
              <img 
                src={token.image} 
                alt={token.symbol} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
          </div>
          <div>
            <div style={{ fontWeight: '600', textTransform: 'uppercase' }}>{token.symbol}</div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{token.name}</div>
          </div>
        </div>
      </td>

      {/* Network */}
      <td style={{ padding: '12px 16px' }}>
        {multiChain ? (
          <span style={{
            background: 'rgba(147, 51, 234, 0.2)',
            color: '#a855f7',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.6rem',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            Multi-chain
          </span>
        ) : (
          <NetworkBadge chain={networkKey || 'eth'} small />
        )}
      </td>

      {/* Price */}
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <div style={{ fontWeight: '600' }}>{formatUSD(token.current_price || 0)}</div>
      </td>

      {/* 24h Change */}
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <span style={{ 
          color: isPositive ? '#10b981' : '#ef4444',
          fontWeight: '600'
        }}>
          {formatPercent(priceChange)}
        </span>
      </td>

      {/* Market Cap */}
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        {formatUSD(token.market_cap || 0)}
      </td>

      {/* 24h Volume */}
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        {formatUSD(token.total_volume || 0)}
      </td>

      {/* Action */}
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrack(token);
          }}
          style={{
            padding: '5px 10px',
            background: isTracked ? THEME.bg.tertiary : THEME.accent.primary,
            border: `1px solid ${isTracked ? THEME.accent.success : THEME.accent.primary}`,
            borderRadius: '4px',
            color: isTracked ? THEME.accent.success : '#fff',
            fontSize: '0.7rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {isTracked ? '✓' : '+'}
        </button>
      </td>
    </tr>
  );
};

// ============================================
// MARKET OVERVIEW SECTION (kept inline)
// ============================================

// ============================================
// MARKET OVERVIEW SECTION (using CoinGecko)
// ============================================

const MarketOverview = ({ onTrackToken, trackedTokens }) => {
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMarketTab, setActiveMarketTab] = useState('gainers');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch top 250 tokens to have enough for filtering
      const response = await fetch(
        '/api/moralis?source=coingecko&endpoint=' + encodeURIComponent(
          '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h'
        )
      );
      
      if (response.ok) {
        const data = await response.json();
        setAllTokens(data || []);
      } else if (response.status === 429) {
        console.warn('CoinGecko rate limited, will retry');
        setError('Rate limited by CoinGecko. Data will refresh automatically.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Market data response error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch market data');
      }
    } catch (err) {
      console.error('Market data error:', err);
      // Only show error if we don't have any data
      if (allTokens.length === 0) {
        setError('Failed to load market data. CoinGecko API may be rate limited.');
      }
    } finally {
      setLoading(false);
    }
  }, [allTokens.length]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, MARKET_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeMarketTab]);

  const isTokenTracked = (token) => {
    return trackedTokens.some(t => 
      t.coingeckoId === token.id || t.symbol?.toLowerCase() === token.symbol?.toLowerCase()
    );
  };

  const handleTrack = async (token) => {
    // Fetch detailed token info to get contract addresses
    try {
      const response = await fetch(
        '/api/moralis?source=coingecko&endpoint=' + encodeURIComponent(`/coins/${token.id}`)
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Find the first available contract address
        let contractAddress = null;
        let chain = 'eth';
        
        if (data.platforms) {
          for (const [platform, address] of Object.entries(data.platforms)) {
            if (address && COINGECKO_PLATFORM_MAP[platform]) {
              contractAddress = address;
              chain = COINGECKO_PLATFORM_MAP[platform];
              break;
            }
          }
        }
        
        onTrackToken({
          address: contractAddress || token.id,
          symbol: token.symbol?.toUpperCase(),
          name: token.name,
          chain: chain,
          logo: token.image || '🪙',
          coingeckoId: token.id,
          hasContractAddress: !!contractAddress
        });
      } else {
        // Fallback without contract address
        onTrackToken({
          address: token.id,
          symbol: token.symbol?.toUpperCase(),
          name: token.name,
          chain: 'eth',
          logo: token.image || '🪙',
          coingeckoId: token.id,
          hasContractAddress: false
        });
      }
    } catch (err) {
      console.error('Failed to fetch token details:', err);
      // Fallback
      onTrackToken({
        address: token.id,
        symbol: token.symbol?.toUpperCase(),
        name: token.name,
        chain: 'eth',
        logo: token.image || '🪙',
        coingeckoId: token.id,
        hasContractAddress: false
      });
    }
  };

  // Get tokens based on active tab
  const getDisplayTokens = () => {
    const tokens = [...allTokens];
    
    switch (activeMarketTab) {
      case 'gainers':
        return tokens
          .filter(t => (t.price_change_percentage_24h || 0) > 0)
          .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
          .slice(0, 100);
      case 'losers':
        return tokens
          .filter(t => (t.price_change_percentage_24h || 0) < 0)
          .sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0))
          .slice(0, 100);
      case 'volume':
        return tokens
          .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0))
          .slice(0, 100);
      default:
        return tokens.slice(0, 100);
    }
  };

  const allDisplayTokens = getDisplayTokens();
  const totalPages = Math.ceil(allDisplayTokens.length / TOKENS_PER_PAGE);
  const startIndex = (currentPage - 1) * TOKENS_PER_PAGE;
  const displayTokens = allDisplayTokens.slice(startIndex, startIndex + TOKENS_PER_PAGE);

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: '600',
          margin: 0,
          color: '#fff'
        }}>
          Market Overview
        </h2>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          Data from CoinGecko • Top 100 tokens • Auto-refresh
        </div>
      </div>

      {/* Market Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        borderBottom: `1px solid ${THEME.border.default}`,
        paddingBottom: '12px'
      }}>
        {[
          { id: 'gainers', label: 'Top Gainers' },
          { id: 'losers', label: 'Top Losers' },
          { id: 'volume', label: 'Top Volume' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMarketTab(tab.id)}
            style={{
              padding: '8px 16px',
              background: activeMarketTab === tab.id ? THEME.bg.tertiary : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeMarketTab === tab.id ? THEME.text.primary : THEME.text.secondary,
              fontSize: '0.8125rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '60px',
          background: THEME.bg.secondary,
          borderRadius: '8px',
          border: `1px solid ${THEME.border.default}`
        }}>
          <LoadingSpinner size={24} />
          <span style={{ marginLeft: '12px', color: THEME.text.secondary }}>Loading market data...</span>
        </div>
      ) : error ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: THEME.bg.secondary,
          borderRadius: '8px',
          border: `1px solid ${THEME.border.default}`,
          color: THEME.accent.error
        }}>
          {error}
          <button
            onClick={fetchMarketData}
            style={{
              display: 'block',
              margin: '16px auto 0',
              padding: '8px 16px',
              background: THEME.bg.tertiary,
              border: `1px solid ${THEME.border.default}`,
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div style={{
            background: THEME.bg.secondary,
            border: `1px solid ${THEME.border.default}`,
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ 
                    background: 'rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>#</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>TOKEN</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>NETWORK</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>PRICE</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>24H %</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>MARKET CAP</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>24H VOLUME</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>TRACK</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTokens.map((token, idx) => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      rank={startIndex + idx + 1}
                      onTrack={handleTrack}
                      isTracked={isTokenTracked(token)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

// ============================================
// TOKEN SEARCH COMPONENT (kept inline)
// ============================================

// ============================================
// TOKEN SEARCH COMPONENT (with ticker search)
// ============================================

const TokenSearch = ({ tokens, selectedToken, onSelect, onAddToken, onRemoveToken }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // Check if it looks like a contract address
        const isAddress = searchQuery.startsWith('0x') || searchQuery.length > 30;
        
        if (isAddress) {
          // Direct add for contract addresses
          setSearchResults([{
            id: searchQuery,
            symbol: 'CUSTOM',
            name: 'Custom Token',
            isAddress: true
          }]);
          setShowResults(true);
        } else {
          // Search by ticker/name using CoinGecko
          const response = await fetch(
            '/api/moralis?source=coingecko&endpoint=' + encodeURIComponent(`/search?query=${searchQuery}`)
          );
          
          if (response.ok) {
            const data = await response.json();
            const coins = (data.coins || []).slice(0, 10);
            setSearchResults(coins);
            setShowResults(coins.length > 0);
          }
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = async (result) => {
    setSearching(true);
    
    try {
      if (result.isAddress) {
        // Direct contract address - try to detect chain from address format
        let detectedChain = 'eth'; // default
        if (searchQuery.length >= 32 && searchQuery.length <= 44 && !searchQuery.startsWith('0x')) {
          detectedChain = 'solana';
        }
        
        onAddToken({
          address: searchQuery,
          symbol: 'CUSTOM',
          name: 'Custom Token',
          chain: detectedChain,
          logo: '🪙',
          hasContractAddress: true
        });
      } else {
        // Fetch token details from CoinGecko to get contract address
        const response = await fetch(
          '/api/moralis?source=coingecko&endpoint=' + encodeURIComponent(`/coins/${result.id}`)
        );
        
        if (response.ok) {
          const data = await response.json();
          
          // Find first available contract address and chain
          let contractAddress = null;
          let actualChain = 'eth';
          
          if (data.platforms) {
            // Priority order for chains
            const chainPriority = ['ethereum', 'base', 'arbitrum-one', 'polygon-pos', 'binance-smart-chain', 'solana'];
            
            for (const platform of chainPriority) {
              if (data.platforms[platform] && COINGECKO_PLATFORM_MAP[platform]) {
                contractAddress = data.platforms[platform];
                actualChain = COINGECKO_PLATFORM_MAP[platform];
                break;
              }
            }
            
            // If no priority chain found, try any available
            if (!contractAddress) {
              for (const [platform, address] of Object.entries(data.platforms)) {
                if (address && COINGECKO_PLATFORM_MAP[platform]) {
                  contractAddress = address;
                  actualChain = COINGECKO_PLATFORM_MAP[platform];
                  break;
                }
              }
            }
          }
          
          onAddToken({
            address: contractAddress || result.id,
            symbol: result.symbol?.toUpperCase() || 'UNKNOWN',
            name: result.name || 'Unknown Token',
            chain: actualChain,
            logo: result.large || result.thumb || '🪙',
            coingeckoId: result.id,
            hasContractAddress: !!contractAddress
          });
        }
      }
    } catch (err) {
      console.error('Failed to add token:', err);
    } finally {
      setSearching(false);
      setSearchQuery('');
      setShowResults(false);
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Search Bar */}
      <div style={{
        background: THEME.bg.secondary,
        border: `1px solid ${THEME.border.default}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        position: 'relative'
      }}>
        <div style={{ 
          fontSize: '0.75rem', 
          color: THEME.text.secondary, 
          marginBottom: '12px'
        }}>
          Search by token ticker, name, or contract address
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search: ETH, Bitcoin, 0x..."
              style={{
                width: '100%',
                padding: '10px 14px',
                background: THEME.bg.primary,
                border: `1px solid ${THEME.border.default}`,
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
            
            {/* Search Results Dropdown */}
            {showResults && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: THEME.bg.secondary,
                border: `1px solid ${THEME.border.default}`,
                borderRadius: '6px',
                marginTop: '4px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 100
              }}>
                {searchResults.map((result, idx) => (
                  <div
                    key={result.id || idx}
                    onClick={() => handleSelectResult(result)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${THEME.border.subtle}`,
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = THEME.bg.tertiary}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {result.thumb && (
                      <img 
                        src={result.thumb} 
                        alt="" 
                        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: '500', color: '#fff' }}>
                        {result.symbol?.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: THEME.text.secondary }}>
                        {result.name}
                      </div>
                    </div>
                    {result.market_cap_rank && (
                      <span style={{ 
                        marginLeft: 'auto', 
                        fontSize: '0.7rem', 
                        color: '#888' 
                      }}>
                        #{result.market_cap_rank}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {searching && (
            <LoadingSpinner size={20} />
          )}
        </div>
      </div>

      {/* Tracked Tokens */}
      {tokens.length > 0 && (
        <div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#888', 
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Your Tracked Tokens ({tokens.length})
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            {tokens.map((token) => (
              <div
                key={`${token.chain}-${token.address}`}
                style={{
                  padding: '8px 12px',
                  background: selectedToken?.address === token.address ? THEME.accent.primary : THEME.bg.tertiary,
                  border: `1px solid ${selectedToken?.address === token.address ? THEME.accent.primary : THEME.border.default}`,
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <button
                  onClick={() => onSelect(token)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: selectedToken?.address === token.address ? '#fff' : THEME.text.primary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: 0
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>
                    {typeof token.logo === 'string' && token.logo.startsWith('http') ? (
                      <img src={token.logo} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                    ) : (
                      token.logo || '🪙'
                    )}
                  </span>
                  <span>{token.symbol}</span>
                  <NetworkBadge chain={token.chain} small />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveToken(token);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '3px',
                    color: '#888',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    marginLeft: '4px'
                  }}
                  title="Remove token"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// STAT CARD COMPONENT
// ============================================


// ============================================
// MAIN APP COMPONENT
// ============================================

export default function App() {
  // View state
  const [activeView, setActiveView] = useState('insights');
  
  // Token management
  const [tokens, setTokens] = useState(() => {
    const saved = localStorage.getItem('trackedTokens');
    return saved ? JSON.parse(saved) : [];
  });
  // Start with no token selected — insights page is the default
  const [selectedToken, setSelectedToken] = useState(null);

  // Data state
  const [holders, setHolders] = useState([]);
  const [previousHolders, setPreviousHolders] = useState({});
  const [transfers, setTransfers] = useState([]);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenPrice, setTokenPrice] = useState(0);
  const [snapshotComparison, setSnapshotComparison] = useState({ 
    newWhales: [], 
    exitedWhales: [], 
    changes: {} 
  });
  
  // Phase 4: Price history and wallet profiler
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceTimeframe, setPriceTimeframe] = useState('7'); // days
  const [poolsData, setPoolsData] = useState([]);
  
  // Phase 5: Smart Money state (for insights engine)
  const [smHolders, setSmHolders] = useState([]);
  const [smFlowData, setSmFlowData] = useState([]);
  const [smWhoBoughtSold, setSmWhoBoughtSold] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(SNAPSHOT_INTERVAL);
  const [sortConfig, setSortConfig] = useState({ key: 'balance', direction: 'desc' });
  const [activeTab, setActiveTab] = useState('holders');
  
  // Pagination state
  const [holderPage, setHolderPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  
  // Transaction filter state
  const [txMinAmount, setTxMinAmount] = useState(0);
  const [txType, setTxType] = useState('all');

  // Save tokens to localStorage
  useEffect(() => {
    localStorage.setItem('trackedTokens', JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    if (selectedToken) {
      localStorage.setItem('selectedToken', JSON.stringify(selectedToken));
    }
  }, [selectedToken]);

  // Check if token has a valid contract address for Moralis
  const canFetchFromMoralis = (token) => {
    if (!token?.hasContractAddress || !token?.address) return false;
    
    // Solana addresses are base58 encoded, typically 32-44 characters
    if (token.chain === 'solana') {
      return token.address.length >= 32 && token.address.length <= 44;
    }
    
    // EVM addresses start with 0x
    return token.address.startsWith('0x');
  };

  // API fetch function
  const fetchFromAPI = async (endpoint, chain) => {
    const isSolana = chain === 'solana';
    const url = `/api/moralis?endpoint=${encodeURIComponent(endpoint)}${isSolana ? '&chain=solana' : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }
    return response.json();
  };

  // Fetch token metadata and market data
  const fetchTokenInfo = useCallback(async () => {
    if (!selectedToken || !canFetchFromMoralis(selectedToken)) return null;
    
    // Try CoinGecko first if we have coingeckoId (more reliable for market data)
    if (selectedToken.coingeckoId) {
      try {
        const response = await fetch(
          `/api/moralis?source=coingecko&endpoint=${encodeURIComponent(`/coins/${selectedToken.coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false`)}`
        );
        if (response.ok) {
          const data = await response.json();
          return {
            symbol: data.symbol?.toUpperCase(),
            name: data.name,
            decimals: data.detail_platforms?.[NETWORKS[selectedToken.chain]?.coingeckoId]?.decimal_place || 18,
            logo: data.image?.large || data.image?.small,
            market_cap: data.market_data?.market_cap?.usd,
            total_volume: data.market_data?.total_volume?.usd,
            price_change_24h: data.market_data?.price_change_percentage_24h,
            circulating_supply: data.market_data?.circulating_supply,
            total_supply: data.market_data?.total_supply,
            max_supply: data.market_data?.max_supply,
            ath: data.market_data?.ath?.usd,
            ath_date: data.market_data?.ath_date?.usd,
            atl: data.market_data?.atl?.usd,
            atl_date: data.market_data?.atl_date?.usd,
            fully_diluted_valuation: data.market_data?.fully_diluted_valuation?.usd,
            links: {
              homepage: data.links?.homepage?.[0],
              twitter: data.links?.twitter_screen_name ? `https://twitter.com/${data.links.twitter_screen_name}` : null,
              telegram: data.links?.telegram_channel_identifier ? `https://t.me/${data.links.telegram_channel_identifier}` : null,
              discord: data.links?.chat_url?.find(u => u.includes('discord')),
              github: data.links?.repos_url?.github?.[0]
            },
            description: data.description?.en?.slice(0, 500),
            categories: data.categories,
            contract_address: selectedToken.address
          };
        }
      } catch (err) {
        console.error('CoinGecko token info fetch error:', err);
      }
    }
    
    // Fallback to Moralis for EVM chains
    if (selectedToken.chain !== 'solana') {
      try {
        const data = await fetchFromAPI(
          `/erc20/metadata?chain=${selectedToken.chain}&addresses[]=${selectedToken.address}`
        );
        return data[0] || null;
      } catch (err) {
        console.error('Token info fetch error:', err);
        return null;
      }
    }
    
    // Solana fallback - use basic info from selection
    return {
      symbol: selectedToken.symbol,
      name: selectedToken.name,
      decimals: 9,
      logo: selectedToken.logo
    };
  }, [selectedToken]);

  // Fetch token price (CoinGecko primary, Moralis fallback for EVM only)
  const fetchTokenPrice = useCallback(async () => {
    if (!selectedToken) return 0;
    
    // Try CoinGecko first if we have coingeckoId (works for all chains including Solana)
    if (selectedToken.coingeckoId) {
      try {
        const response = await fetch(
          `/api/moralis?source=coingecko&endpoint=${encodeURIComponent(`/simple/price?ids=${selectedToken.coingeckoId}&vs_currencies=usd`)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data[selectedToken.coingeckoId]?.usd) {
            return data[selectedToken.coingeckoId].usd;
          }
        }
      } catch (err) {
        console.error('CoinGecko price fetch error:', err);
      }
    }
    
    // Fallback to Moralis for EVM chains only (Solana API is unreliable)
    if (!canFetchFromMoralis(selectedToken) || selectedToken.chain === 'solana') return 0;
    
    try {
      const data = await fetchFromAPI(
        `/erc20/${selectedToken.address}/price?chain=${selectedToken.chain}`
      );
      return data.usdPrice || 0;
    } catch (err) {
      console.error('Price fetch error:', err);
      return 0;
    }
  }, [selectedToken]);

  // Fetch top holders — Nansen primary (uncapped), Moralis fallback (100 cap)
  const fetchHolders = useCallback(async () => {
    if (!selectedToken || !canFetchFromMoralis(selectedToken)) return [];
    
    if (selectedToken.chain === 'solana') {
      // Nansen supports Solana — try it
      try {
        const nansenHolders = await getTokenHolders(
          selectedToken.address, 'solana', { labelType: 'all_holders', perPage: 100 }
        );
        if (nansenHolders && nansenHolders.length > 0) {
          nansenHolders.chainsFetched = ['solana'];
          nansenHolders.isMultiChain = false;
          console.log(`Nansen returned ${nansenHolders.length} Solana holders`);
          return nansenHolders;
        }
      } catch (e) {
        console.log('Nansen Solana holders unavailable:', e.message);
      }
      return [];
    }
    
    // ---- Try Nansen first (no 100-holder cap) ----
    try {
      const nansenHolders = await getTokenHolders(
        selectedToken.address, selectedToken.chain, 
        { labelType: 'all_holders', perPage: 100 }
      );
      if (nansenHolders && nansenHolders.length > 0) {
        nansenHolders.chainsFetched = [selectedToken.chain];
        nansenHolders.isMultiChain = false;
        console.log(`Nansen returned ${nansenHolders.length} holders (primary source)`);
        return nansenHolders;
      }
    } catch (nansenErr) {
      // Nansen unavailable — fall through to Moralis
      console.log('Nansen holders unavailable, falling back to Moralis:', nansenErr.message);
    }

    // ---- Moralis fallback (capped at ~100) ----
    try {
      let allHolders = [];
      let chainsFetched = [selectedToken.chain];
      
      const primaryData = await fetchFromAPI(
        `/erc20/${selectedToken.address}/owners?chain=${selectedToken.chain}&limit=100&order=DESC`
      );
      const primaryHolders = (primaryData.result || []).map(h => ({
        ...h,
        chain: selectedToken.chain,
        chainName: NETWORKS[selectedToken.chain]?.name
      }));
      allHolders.push(...primaryHolders);
      
      // Multi-chain aggregation via CoinGecko detail cache
      if (selectedToken.coingeckoId) {
        try {
          const cgData = await getCoinGeckoDetail(selectedToken.coingeckoId);
          if (cgData) {
            const platforms = extractPlatforms(cgData);
            const otherChains = platforms.filter(p => p.chain !== selectedToken.chain);
            
            if (otherChains.length > 0) {
              const otherResults = await Promise.all(
                otherChains.map(({ chain, address }) =>
                  fetchFromAPI(`/erc20/${address}/owners?chain=${chain}&limit=50&order=DESC`)
                    .then(data => {
                      chainsFetched.push(chain);
                      return (data.result || []).map(h => ({
                        ...h, chain, chainName: NETWORKS[chain]?.name
                      }));
                    })
                    .catch(() => [])
                )
              );
              otherResults.forEach(holders => allHolders.push(...holders));
            }
          }
        } catch (e) {
          console.log('Could not fetch multi-chain data:', e);
        }
      }
      
      // Aggregate holders by address (same wallet across chains)
      const holderMap = new Map();
      allHolders.forEach(h => {
        const addr = h.owner_address?.toLowerCase();
        if (!addr) return;
        
        if (holderMap.has(addr)) {
          const existing = holderMap.get(addr);
          existing.balance = (parseFloat(existing.balance) || 0) + (parseFloat(h.balance) || 0);
          existing.balance_formatted = (parseFloat(existing.balance_formatted) || 0) + (parseFloat(h.balance_formatted) || 0);
          existing.percentage_relative_to_total_supply = (parseFloat(existing.percentage_relative_to_total_supply) || 0) + (parseFloat(h.percentage_relative_to_total_supply) || 0);
          if (!existing.chains.includes(h.chain)) {
            existing.chains.push(h.chain);
          }
        } else {
          holderMap.set(addr, { ...h, chains: [h.chain] });
        }
      });
      
      const aggregatedHolders = Array.from(holderMap.values())
        .sort((a, b) => parseFloat(b.balance_formatted || b.balance || 0) - parseFloat(a.balance_formatted || a.balance || 0))
        .slice(0, 100);
      
      aggregatedHolders.chainsFetched = [...new Set(chainsFetched)];
      aggregatedHolders.isMultiChain = aggregatedHolders.chainsFetched.length > 1;
      
      console.log(`Moralis fallback returned ${aggregatedHolders.length} holders (capped)`);
      return aggregatedHolders;
    } catch (err) {
      console.error('Holders fetch error:', err);
      return [];
    }
  }, [selectedToken]);

  // Fetch recent transactions (transfers + swaps/trades)
  // Fetch recent trades from GeckoTerminal (free API with direct swap data)
  const fetchGeckoTerminalTrades = useCallback(async () => {
    const network = NETWORKS[selectedToken?.chain];
    if (!network?.geckoTerminalId || !selectedToken?.address) return [];
    
    try {
      // First get pools for this token
      const poolsUrl = `/api/moralis?source=geckoterminal&endpoint=${encodeURIComponent(
        `/networks/${network.geckoTerminalId}/tokens/${selectedToken.address}/pools?page=1`
      )}`;
      
      const poolsResponse = await fetch(poolsUrl);
      if (!poolsResponse.ok) return [];
      
      const poolsData = await poolsResponse.json();
      const pools = poolsData?.data || [];
      if (pools.length === 0) return [];
      
      // Get trades from top 3 pools
      const allTrades = [];
      for (const pool of pools.slice(0, 3)) {
        const poolAddress = pool.attributes?.address || pool.id?.split('_')[1];
        if (!poolAddress) continue;
        
        try {
          const tradesUrl = `/api/moralis?source=geckoterminal&endpoint=${encodeURIComponent(
            `/networks/${network.geckoTerminalId}/pools/${poolAddress}/trades`
          )}`;
          
          const tradesResponse = await fetch(tradesUrl);
          if (!tradesResponse.ok) continue;
          
          const tradesData = await tradesResponse.json();
          const trades = tradesData?.data || [];
          
          const mappedTrades = trades.map(trade => {
            const attrs = trade.attributes || {};
            const isBuy = attrs.kind === 'buy';
            
            return {
              transaction_hash: attrs.tx_hash,
              block_timestamp: attrs.block_timestamp,
              trader_address: attrs.tx_from_address || '',
              amount: parseFloat(isBuy ? attrs.to_token_amount : attrs.from_token_amount) || 0,
              usdValue: parseFloat(attrs.volume_in_usd) || 0,
              type: isBuy ? 'buy' : 'sell',
              source: 'geckoterminal',
              pool_name: pool.attributes?.name || 'Unknown Pool',
              pool_address: poolAddress
            };
          });
          
          allTrades.push(...mappedTrades);
        } catch (e) {
          console.log('GeckoTerminal pool error:', e);
        }
      }
      
      return allTrades;
    } catch (err) {
      console.error('GeckoTerminal error:', err);
      return [];
    }
  }, [selectedToken]);

  // Fetch trades from DexScreener (backup/additional source)
  const fetchDexScreenerTrades = useCallback(async () => {
    const network = NETWORKS[selectedToken?.chain];
    if (!network?.dexScreenerId || !selectedToken?.address) return [];
    
    try {
      const url = `/api/moralis?source=dexscreener&endpoint=${encodeURIComponent(
        `/latest/dex/tokens/${selectedToken.address}`
      )}`;
      
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json();
      const pairs = data?.pairs || [];
      
      // DexScreener doesn't provide individual trades in the free API,
      // but we can get recent txns from the pairs endpoint
      // For now, we'll use it as supplementary pool info
      // The main value is the price and liquidity data
      
      return []; // DexScreener free API doesn't have trade history
    } catch (err) {
      console.error('DexScreener error:', err);
      return [];
    }
  }, [selectedToken]);

  // Fetch transfers from Moralis (EVM chains only - wallet-to-wallet movements, no mints/burns)
  const fetchMoralisTransfers = useCallback(async () => {
    // Skip Moralis for Solana - use GeckoTerminal trades instead
    if (!selectedToken || !canFetchFromMoralis(selectedToken) || selectedToken.chain === 'solana') {
      return [];
    }
    
    try {
      const transfersData = await fetchFromAPI(
        `/erc20/${selectedToken.address}/transfers?chain=${selectedToken.chain}&limit=100`
      );
      
      if (!transfersData?.result) return [];
      
      // Filter and map transfers - exclude mints and burns
      return transfersData.result
        .filter(t => {
          const fromLower = (t.from_address || '').toLowerCase();
          const toLower = (t.to_address || '').toLowerCase();
          const zeroAddress = '0x0000000000000000000000000000000000000000';
          // Exclude mints (from zero address) and burns (to zero address)
          return fromLower !== zeroAddress && toLower !== zeroAddress;
        })
        .map(t => {
          const decimals = parseInt(t.token_decimals || tokenInfo?.decimals || 18);
          const amount = parseFloat(t.value || 0) / Math.pow(10, decimals);
          
          return {
            transaction_hash: t.transaction_hash,
            block_timestamp: t.block_timestamp,
            from_address: t.from_address,
            to_address: t.to_address,
            trader_address: t.from_address,
            amount,
            usdValue: amount * tokenPrice,
            type: 'transfer',
            source: 'moralis'
          };
        });
    } catch (err) {
      console.error('Moralis transfers error:', err);
      return [];
    }
  }, [selectedToken, tokenInfo, tokenPrice]);

  // Combined fetch function - gets data from all sources
  const fetchTransfers = useCallback(async () => {
    if (!selectedToken) return [];
    
    try {
      // Fetch from all sources in parallel
      const [geckoTrades, moralisTransfers] = await Promise.all([
        fetchGeckoTerminalTrades(),
        fetchMoralisTransfers()
      ]);
      
      // Combine all transactions
      const allTransactions = [...geckoTrades, ...moralisTransfers];
      
      // Remove duplicates by transaction hash
      const uniqueTransactions = allTransactions.reduce((acc, tx) => {
        const existing = acc.find(t => t.transaction_hash === tx.transaction_hash);
        if (!existing) {
          acc.push(tx);
        } else if (tx.source === 'geckoterminal' && existing.source === 'moralis') {
          // Prefer GeckoTerminal data for swaps (has better USD values)
          const idx = acc.indexOf(existing);
          acc[idx] = tx;
        }
        return acc;
      }, []);
      
      // Sort by timestamp (most recent first)
      return uniqueTransactions.sort((a, b) => {
        const dateA = new Date(a.block_timestamp || 0);
        const dateB = new Date(b.block_timestamp || 0);
        return dateB - dateA;
      });
      
    } catch (err) {
      console.error('Combined fetch error:', err);
      return [];
    }
  }, [selectedToken, fetchGeckoTerminalTrades, fetchMoralisTransfers]);

  // Load all data
  const loadSnapshot = useCallback(async () => {
    if (!selectedToken) return;
    
    if (!canFetchFromMoralis(selectedToken)) {
      setError(`Cannot fetch on-chain data for ${selectedToken.symbol}. This token doesn't have a valid contract address on ${NETWORKS[selectedToken.chain]?.name || selectedToken.chain}. Try searching for it with a different network or use the contract address directly.`);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const [holdersData, price, transfersData, info] = await Promise.all([
        fetchHolders(),
        fetchTokenPrice(),
        fetchTransfers(),
        fetchTokenInfo()
      ]);

      // Get previous snapshot for comparison before saving new one
      const previousSnapshot = SnapshotManager.getLatest(selectedToken.address, selectedToken.chain);
      
      // Save new snapshot
      const snapshots = SnapshotManager.save(selectedToken.address, selectedToken.chain, holdersData);
      const currentSnapshot = snapshots[snapshots.length - 1];
      
      // Calculate comparison
      if (previousSnapshot && currentSnapshot) {
        const comparison = SnapshotManager.compareSnapshots(currentSnapshot, previousSnapshot);
        setSnapshotComparison(comparison);
      } else {
        setSnapshotComparison({ newWhales: [], exitedWhales: [], changes: {} });
      }

      setHolders(holdersData);
      setTokenPrice(price);
      setTransfers(transfersData);
      setTokenInfo(info);
      setLastSnapshot(new Date());
      setTimeRemaining(SNAPSHOT_INTERVAL);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchHolders, fetchTokenPrice, fetchTransfers, fetchTokenInfo, selectedToken]);

  // Fetch price history from CoinGecko
  const fetchPriceHistory = useCallback(async (days = 7) => {
    if (!selectedToken?.coingeckoId) return [];
    
    try {
      const response = await fetch(
        `/api/moralis?source=coingecko&endpoint=${encodeURIComponent(
          `/coins/${selectedToken.coingeckoId}/market_chart?vs_currency=usd&days=${days}`
        )}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return (data.prices || []).map(([timestamp, price]) => ({
          time: new Date(timestamp).toLocaleDateString(),
          timestamp,
          price
        }));
      }
    } catch (err) {
      console.error('Price history fetch error:', err);
    }
    return [];
  }, [selectedToken]);

  // Fetch liquidity pools from GeckoTerminal
  const fetchPools = useCallback(async () => {
    if (!selectedToken?.address) return [];
    
    try {
      let allPools = [];
      let chainsToFetch = [];
      
      // Primary chain
      const primaryNetwork = NETWORKS[selectedToken.chain];
      if (primaryNetwork?.geckoTerminalId) {
        chainsToFetch.push({ chain: selectedToken.chain, address: selectedToken.address, network: primaryNetwork });
      }
      
      // If token has coingeckoId, try to get pools from other chains too
      if (selectedToken.coingeckoId) {
        try {
          const coingeckoRes = await fetch(
            `/api/moralis?source=coingecko&endpoint=${encodeURIComponent(`/coins/${selectedToken.coingeckoId}`)}`
          );
          if (coingeckoRes.ok) {
            const cgData = await coingeckoRes.json();
            const platforms = cgData.platforms || {};
            
            const platformToChain = {
              'ethereum': 'eth',
              'arbitrum-one': 'arbitrum',
              'base': 'base',
              'polygon-pos': 'polygon',
              'binance-smart-chain': 'bsc'
            };
            
            for (const [platform, address] of Object.entries(platforms)) {
              const chainKey = platformToChain[platform];
              if (chainKey && chainKey !== selectedToken.chain && address && NETWORKS[chainKey]?.geckoTerminalId) {
                chainsToFetch.push({ 
                  chain: chainKey, 
                  address: address, 
                  network: NETWORKS[chainKey] 
                });
              }
            }
          }
        } catch (e) {
          console.log('Could not fetch multi-chain pool data:', e);
        }
      }
      
      // Fetch pools from all chains in parallel
      const poolPromises = chainsToFetch.map(async ({ chain, address, network }) => {
        try {
          const response = await fetch(
            `/api/moralis?source=geckoterminal&endpoint=${encodeURIComponent(
              `/networks/${network.geckoTerminalId}/tokens/${address}/pools?page=1`
            )}`
          );
          
          if (response.ok) {
            const data = await response.json();
            return (data.data || []).map(pool => ({
              address: pool.attributes?.address,
              name: pool.attributes?.name,
              dex: pool.relationships?.dex?.data?.id,
              chain: chain,
              chainName: network.name,
              price_usd: parseFloat(pool.attributes?.base_token_price_usd) || 0,
              liquidity_usd: parseFloat(pool.attributes?.reserve_in_usd) || 0,
              volume_24h: parseFloat(pool.attributes?.volume_usd?.h24) || 0,
              price_change_24h: parseFloat(pool.attributes?.price_change_percentage?.h24) || 0,
              transactions_24h: (pool.attributes?.transactions?.h24?.buys || 0) + (pool.attributes?.transactions?.h24?.sells || 0),
              buys_24h: pool.attributes?.transactions?.h24?.buys || 0,
              sells_24h: pool.attributes?.transactions?.h24?.sells || 0
            }));
          }
        } catch (e) {
          console.log(`Pool fetch error for ${chain}:`, e);
        }
        return [];
      });
      
      const poolResults = await Promise.all(poolPromises);
      allPools = poolResults.flat();
      
      // Sort by liquidity
      allPools.sort((a, b) => b.liquidity_usd - a.liquidity_usd);
      
      // Add metadata
      allPools.isMultiChain = chainsToFetch.length > 1;
      allPools.chainsFetched = chainsToFetch.map(c => c.chain);
      
      return allPools;
    } catch (err) {
      console.error('Pools fetch error:', err);
    }
    return [];
  }, [selectedToken]);


  // Load price history when token or timeframe changes
  useEffect(() => {
    if (selectedToken?.coingeckoId && activeView === 'insights') {
      fetchPriceHistory(parseInt(priceTimeframe)).then(setPriceHistory);
      fetchPools().then(setPoolsData);
    }
  }, [selectedToken, priceTimeframe, activeView, fetchPriceHistory, fetchPools]);

  // Load Smart Money data for insights engine (background)
  useEffect(() => {
    if (!selectedToken?.address || selectedToken.chain === 'solana' || activeView !== 'insights') return;
    
    let cancelled = false;
    
    (async () => {
      try {
        const [smH, smF, smWBS] = await Promise.all([
          getTokenHolders(selectedToken.address, selectedToken.chain, { labelType: 'smart_money', perPage: 50 }).catch(() => []),
          getTokenFlows(selectedToken.address, selectedToken.chain, { label: 'smart_money', days: 7 }).catch(() => []),
          getWhoBoughtSold(selectedToken.address, selectedToken.chain, { days: 1 }).catch(() => null)
        ]);
        if (!cancelled) {
          setSmHolders(smH);
          setSmFlowData(smF);
          setSmWhoBoughtSold(smWBS);
        }
      } catch (err) {
        console.warn('SM data load failed (non-blocking):', err.message);
      }
    })();
    
    return () => { cancelled = true; };
  }, [selectedToken, activeView]);

  // Load data when token changes
  useEffect(() => {
    if (activeView === 'insights' && selectedToken) {
      loadSnapshot();
    }
  }, [selectedToken, activeView]);

  // Countdown timer
  useEffect(() => {
    if (activeView !== 'insights' || !selectedToken) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          loadSnapshot();
          return SNAPSHOT_INTERVAL;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loadSnapshot, activeView, selectedToken]);

  // Add new token
  const handleAddToken = (token) => {
    const exists = tokens.some(t => 
      (t.address?.toLowerCase() === token.address?.toLowerCase() && t.chain === token.chain) ||
      (t.coingeckoId && t.coingeckoId === token.coingeckoId)
    );
    if (!exists) {
      const newTokens = [...tokens, token];
      setTokens(newTokens);
      setSelectedToken(token);
      setActiveView('insights');
    } else {
      const existingToken = tokens.find(t => 
        (t.address?.toLowerCase() === token.address?.toLowerCase() && t.chain === token.chain) ||
        (t.coingeckoId && t.coingeckoId === token.coingeckoId)
      );
      if (existingToken) {
        setSelectedToken(existingToken);
        setActiveView('insights');
      }
    }
  };

  // Remove token
  const handleRemoveToken = (tokenToRemove) => {
    const newTokens = tokens.filter(t => 
      !(t.address === tokenToRemove.address && t.chain === tokenToRemove.chain)
    );
    setTokens(newTokens);
    
    if (selectedToken?.address === tokenToRemove.address) {
      setSelectedToken(newTokens[0] || null);
    }
  };

  // Sort holders
  const sortedHolders = React.useMemo(() => {
    const sorted = [...holders];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      if (sortConfig.key === 'balance') {
        aVal = parseFloat(a.balance_formatted || a.balance) || 0;
        bVal = parseFloat(b.balance_formatted || b.balance) || 0;
      } else if (sortConfig.key === 'usd') {
        aVal = parseFloat(a.usd_value || 0);
        bVal = parseFloat(b.usd_value || 0);
      } else if (sortConfig.key === 'percentage') {
        aVal = parseFloat(a.percentage_relative_to_total_supply || 0);
        bVal = parseFloat(b.percentage_relative_to_total_supply || 0);
      } else if (sortConfig.key === 'change') {
        const aBalance = parseFloat(a.balance_formatted || a.balance) || 0;
        const bBalance = parseFloat(b.balance_formatted || b.balance) || 0;
        const aPrev = previousHolders[a.owner_address] || aBalance;
        const bPrev = previousHolders[b.owner_address] || bBalance;
        aVal = aBalance - aPrev;
        bVal = bBalance - bPrev;
      }
      
      return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [holders, sortConfig, previousHolders]);

  const top10PercentCount = Math.max(1, Math.ceil(holders.length * 0.1));

  // Process transactions from all sources
  const processedTransfers = React.useMemo(() => {
    if (!transfers || transfers.length === 0) return [];
    
    // Data already has USD values from respective sources
    const withUsdValues = transfers.map(t => ({
      ...t,
      usdValue: t.usdValue || 0,
      amount: t.amount || 0,
      type: t.type || 'transfer'
    }));
    
    // Sort by USD value (largest first)
    const sortedByValue = [...withUsdValues].sort((a, b) => b.usdValue - a.usdValue);
    
    // Apply filters
    let filtered = sortedByValue;
    
    // Apply minimum USD filter if set
    if (txMinAmount > 0) {
      filtered = filtered.filter(t => t.usdValue >= txMinAmount);
    } else {
      // Auto mode: show top 100 transactions
      filtered = sortedByValue.slice(0, 100);
    }
    
    // Apply type filter
    if (txType !== 'all') {
      filtered = filtered.filter(t => t.type === txType);
    }
    
    return filtered;
  }, [transfers, txMinAmount, txType]);

  const paginatedTransfers = React.useMemo(() => {
    const start = (txPage - 1) * TRANSACTIONS_PER_PAGE;
    return processedTransfers.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [processedTransfers, txPage]);

  // ============================================
  // INSIGHTS ENGINE — generates insights from all current data
  // ============================================
  const insights = React.useMemo(() => {
    if (!selectedToken || holders.length === 0) return [];
    return generateInsights({
      holders,
      previousHolders,
      snapshotComparison,
      tokenInfo,
      tokenPrice,
      transfers,
      poolsData,
      priceHistory,
      smHolders,
      flowData: smFlowData,
      whoBoughtSold: smWhoBoughtSold
    });
  }, [holders, previousHolders, snapshotComparison, tokenInfo, tokenPrice, transfers, poolsData, priceHistory, smHolders, smFlowData, smWhoBoughtSold, selectedToken]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span style={{ opacity: 0.3 }}>↕</span>;
    return sortConfig.direction === 'desc' ? <span>↓</span> : <span>↑</span>;
  };

  const network = selectedToken ? (NETWORKS[selectedToken.chain] || NETWORKS.eth) : NETWORKS.eth;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.bg.primary,
      color: '#fff',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      padding: '24px'
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: `1px solid ${THEME.border.default}`
        }}>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              margin: '0 0 4px 0',
              color: '#fff',
              letterSpacing: '-0.5px'
            }}>
              Edge Analytics
            </h1>
            <p style={{ margin: 0, color: THEME.text.secondary, fontSize: '0.875rem' }}>
              Smart money insights & on-chain intelligence
            </p>
          </div>
          
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: THEME.bg.secondary,
            borderRadius: '8px',
            padding: '3px',
            border: `1px solid ${THEME.border.default}`
          }}>
            <button
              onClick={() => setActiveView('tokens')}
              style={{
                padding: '8px 16px',
                background: activeView === 'tokens' ? THEME.accent.primary : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeView === 'tokens' ? '#fff' : THEME.text.secondary,
                fontSize: '0.8125rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Top Tokens
            </button>
            <button
              onClick={() => setActiveView('insights')}
              style={{
                padding: '8px 16px',
                background: activeView === 'insights' ? THEME.accent.primary : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeView === 'insights' ? '#fff' : THEME.text.secondary,
                fontSize: '0.8125rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Insights
            </button>
          </div>
        </div>

        {/* Market Overview View */}
        {activeView === 'tokens' && (
          <MarketOverview 
            onTrackToken={handleAddToken}
            trackedTokens={tokens}
          />
        )}

        {/* Token Tracker View */}
        {activeView === 'insights' && (
          <>
            <TokenSearch
              tokens={tokens}
              selectedToken={selectedToken}
              onSelect={setSelectedToken}
              onAddToken={handleAddToken}
              onRemoveToken={handleRemoveToken}
            />

            {!selectedToken && (
              <MarketInsights onSelectToken={handleAddToken} trackedTokens={tokens} />
            )}

            {selectedToken && (
              <>
                {/* Back to Market Radar */}
                <button onClick={() => setSelectedToken(null)} style={{
                  padding: '6px 14px', background: THEME.bg.tertiary, border: `1px solid ${THEME.border.default}`,
                  borderRadius: '6px', color: THEME.text.secondary, fontSize: '0.75rem', cursor: 'pointer',
                  marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  ← Back to Market Radar
                </button>
                {/* Timer Card */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  marginBottom: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>
                      Next Snapshot In
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: 'monospace' }}>
                      {formatTimeRemaining(timeRemaining)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>
                      Last Updated
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                      {lastSnapshot ? lastSnapshot.toLocaleString() : 'Never'}
                    </div>
                  </div>
                  <button
                    onClick={loadSnapshot}
                    disabled={loading || !canFetchFromMoralis(selectedToken)}
                    style={{
                      padding: '8px 16px',
                      background: loading ? THEME.bg.tertiary : THEME.accent.primary,
                      border: `1px solid ${loading ? THEME.border.default : THEME.accent.primary}`,
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8125rem',
                      fontWeight: '500',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: canFetchFromMoralis(selectedToken) ? 1 : 0.5
                    }}
                  >
                    {loading ? <LoadingSpinner size={14} /> : null}
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* Error Display */}
                {error && (
                  <div style={{
                    background: THEME.bg.tertiary,
                    border: `1px solid ${THEME.accent.error}40`,
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '20px',
                    color: THEME.accent.error,
                    fontSize: '0.8rem'
                  }}>
                    {error}
                  </div>
                )}

                {/* Phase 4: Social Links */}
                {tokenInfo?.links && (
                  <SocialLinks links={tokenInfo.links} />
                )}

                {/* Phase 4: Price Chart */}
                {selectedToken?.coingeckoId && (
                  <PriceChart 
                    data={priceHistory} 
                    timeframe={priceTimeframe} 
                    setTimeframe={setPriceTimeframe} 
                  />
                )}

                {/* Phase 4: Token Metrics */}
                {canFetchFromMoralis(selectedToken) && (
                  <TokenMetricsCard 
                    tokenInfo={tokenInfo} 
                    holders={holders}
                    poolsData={poolsData}
                  />
                )}

                {/* Phase 4: Holder Distribution Chart */}
                {holders.length > 0 && (
                  <HolderDistributionChart holders={holders} />
                )}

                {/* Phase 4: Liquidity & Activity */}
                {poolsData.length > 0 && (
                  <PoolsTable pools={poolsData} />
                )}

                {/* Insights Feed — the hero section */}
                {!loading && holders.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <InsightsFeed insights={insights} />
                  </div>
                )}

                {/* Tabs */}
                {canFetchFromMoralis(selectedToken) && (
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '16px'
                  }}>
                    <button
                      onClick={() => setActiveTab('holders')}
                      style={{
                        padding: '8px 16px',
                        background: activeTab === 'holders' ? THEME.accent.primary : THEME.bg.tertiary,
                        border: `1px solid ${activeTab === 'holders' ? THEME.accent.primary : THEME.border.default}`,
                        borderRadius: '6px',
                        color: activeTab === 'holders' ? '#fff' : THEME.text.secondary,
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Top Holders ({holders.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('transfers')}
                      style={{
                        padding: '8px 16px',
                        background: activeTab === 'transfers' ? THEME.accent.primary : THEME.bg.tertiary,
                        border: `1px solid ${activeTab === 'transfers' ? THEME.accent.primary : THEME.border.default}`,
                        borderRadius: '6px',
                        color: activeTab === 'transfers' ? '#fff' : THEME.text.secondary,
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Recent Transactions ({processedTransfers.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('smartmoney')}
                      style={{
                        padding: '8px 16px',
                        background: activeTab === 'smartmoney' ? THEME.accent.primary : THEME.bg.tertiary,
                        border: `1px solid ${activeTab === 'smartmoney' ? THEME.accent.primary : THEME.border.default}`,
                        borderRadius: '6px',
                        color: activeTab === 'smartmoney' ? '#fff' : THEME.text.secondary,
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Smart Money
                    </button>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '48px',
                    background: THEME.bg.secondary,
                    borderRadius: '8px',
                    border: `1px solid ${THEME.border.default}`
                  }}>
                    <LoadingSpinner size={24} />
                    <span style={{ marginLeft: '12px', color: THEME.text.secondary }}>Loading...</span>
                  </div>
                )}

                {/* Holders Table */}
                {!loading && activeTab === 'holders' && holders.length > 0 && (
                  <div style={{
                    background: THEME.bg.secondary,
                    border: `1px solid ${THEME.border.default}`,
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ 
                            background: 'rgba(255,255,255,0.05)',
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>#</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>WALLET</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('balance')}>
                              BALANCE <SortIcon column="balance" />
                            </th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('usd')}>
                              USD VALUE <SortIcon column="usd" />
                            </th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('percentage')}>
                              % SUPPLY <SortIcon column="percentage" />
                            </th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>TYPE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedHolders.map((holder, idx) => {
                            const balance = parseFloat(holder.balance_formatted || holder.balance) || 0;
                            const usdValue = balance * tokenPrice;
                            const pct = parseFloat(holder.percentage_relative_to_total_supply || 0);
                            const globalIdx = idx;
                            
                            // Check for badges
                            const isNew = snapshotComparison.newWhales.includes(holder.owner_address);
                            const change = snapshotComparison.changes[holder.owner_address];
                            const badges = [];
                            
                            if (isNew) {
                              badges.push({ text: '🆕 NEW', bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' });
                            }
                            if (change && Math.abs(change.changePercent) >= WHALE_CHANGE_THRESHOLD) {
                              if (change.changePercent > 0) {
                                badges.push({ text: `📈 +${change.changePercent.toFixed(1)}%`, bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' });
                              } else {
                                badges.push({ text: `📉 ${change.changePercent.toFixed(1)}%`, bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' });
                              }
                            }
                            
                            return (
                              <tr 
                                key={holder.owner_address}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = THEME.bg.hover}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    background: globalIdx < 3 ? THEME.accent.warning : globalIdx < 10 ? THEME.accent.primary : THEME.bg.tertiary,
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    color: globalIdx < 10 ? '#fff' : THEME.text.muted
                                  }}>
                                    {globalIdx + 1}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <AddressDisplay 
                                    address={holder.owner_address} 
                                    chain={holder.chain || selectedToken.chain}
                                    badges={badges}
                                  />
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{ fontWeight: '500' }}>{formatNumber(balance)}</span>
                                  <span style={{ color: '#888', marginLeft: '4px' }}>
                                    {tokenInfo?.symbol || selectedToken.symbol}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{ color: THEME.accent.success, fontWeight: '500' }}>
                                    {formatUSD(usdValue)}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '50px',
                                      height: '4px',
                                      background: THEME.bg.tertiary,
                                      borderRadius: '2px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${Math.min(pct * 3, 100)}%`,
                                        height: '100%',
                                        background: THEME.accent.primary,
                                        borderRadius: '2px'
                                      }} />
                                    </div>
                                    <span style={{ color: THEME.text.secondary, fontSize: '0.75rem' }}>
                                      {pct.toFixed(2)}%
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  {change ? (
                                    <span style={{
                                      color: change.changePercent > 0 ? THEME.accent.success : THEME.accent.error,
                                      fontWeight: '500',
                                      fontSize: '0.75rem'
                                    }}>
                                      {change.changePercent > 0 ? '+' : ''}{change.changePercent.toFixed(2)}%
                                    </span>
                                  ) : isNew ? (
                                    <span style={{ color: THEME.accent.success, fontSize: '0.75rem' }}>New</span>
                                  ) : (
                                    <span style={{ color: '#888', fontSize: '0.8rem' }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                  <span style={{
                                    background: holder.is_contract 
                                      ? 'rgba(255, 159, 64, 0.2)'
                                      : 'rgba(0, 212, 255, 0.2)',
                                    color: holder.is_contract ? '#f59e0b' : THEME.accent.secondary,
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    textTransform: 'uppercase'
                                  }}>
                                    {holder.is_contract ? '📜 Contract' : '👤 Wallet'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Holder Pagination */}
                    {sortedHolders.length > TOKENS_PER_PAGE && (
                      <Pagination 
                        currentPage={holderPage}
                        totalPages={Math.ceil(sortedHolders.length / TOKENS_PER_PAGE)}
                        onPageChange={setHolderPage}
                      />
                    )}
                    
                    {loadingMore && (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '12px',
                        color: '#888',
                        fontSize: '0.8rem'
                      }}>
                        <LoadingSpinner size={16} /> Loading more holders...
                      </div>
                    )}
                  </div>
                )}

                {/* Transactions Table */}
                {!loading && activeTab === 'transfers' && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden'
                  }}>
                    <TransactionFilters 
                      minAmount={txMinAmount}
                      setMinAmount={setTxMinAmount}
                      txType={txType}
                      setTxType={setTxType}
                    />
                    
                    {processedTransfers.length === 0 ? (
                      <div style={{ 
                        padding: '40px', 
                        textAlign: 'center',
                        color: '#888'
                      }}>
                        No transactions found with current filters
                      </div>
                    ) : (
                      <>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ 
                                background: 'rgba(255,255,255,0.05)',
                                borderBottom: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>#</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>TYPE</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>WALLET</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>DETAILS</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>AMOUNT</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>USD VALUE</th>
                                <th style={{ padding: '16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.75rem' }}>TIME</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedTransfers.map((transfer, idx) => {
                                const globalIdx = (txPage - 1) * TRANSACTIONS_PER_PAGE + idx;
                                
                                return (
                                  <tr 
                                    key={`${transfer.transaction_hash}-${idx}`}
                                    style={{
                                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                                      transition: 'background 0.2s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <td style={{ padding: '14px 16px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '28px',
                                        background: transfer.usdValue > 100000 
                                          ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)'
                                          : 'rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        color: transfer.usdValue > 100000 ? '#000' : '#888'
                                      }}>
                                        {globalIdx + 1}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span style={{
                                        background: transfer.type === 'buy' 
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : transfer.type === 'sell'
                                          ? 'rgba(239, 68, 68, 0.2)'
                                          : 'rgba(0, 212, 255, 0.2)',
                                        color: transfer.type === 'buy' 
                                          ? '#10b981'
                                          : transfer.type === 'sell'
                                          ? '#ef4444'
                                          : THEME.accent.secondary,
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: '600',
                                        textTransform: 'uppercase'
                                      }}>
                                        {transfer.type === 'buy' ? '🟢 Buy' : 
                                         transfer.type === 'sell' ? '🔴 Sell' : '↔️ Transfer'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      {(transfer.trader_address || transfer.from_address) ? (
                                        <AddressDisplay 
                                          address={transfer.trader_address || transfer.from_address} 
                                          chain={selectedToken.chain}
                                          color={THEME.accent.secondary}
                                        />
                                      ) : (
                                        <span style={{ color: '#888' }}>-</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      {transfer.type === 'buy' || transfer.type === 'sell' ? (
                                        <span style={{ 
                                          color: '#888', 
                                          fontSize: '0.75rem',
                                          maxWidth: '150px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          display: 'block'
                                        }}>
                                          {transfer.pool_name || 'DEX Swap'}
                                        </span>
                                      ) : transfer.to_address ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                          <span style={{ color: '#888' }}>→</span>
                                          <AddressDisplay 
                                            address={transfer.to_address} 
                                            chain={selectedToken.chain}
                                            color="#10b981"
                                          />
                                        </span>
                                      ) : (
                                        <span style={{ color: '#888', fontSize: '0.75rem' }}>-</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span style={{ fontWeight: '600' }}>{formatNumber(transfer.amount)}</span>
                                      <span style={{ color: '#888', marginLeft: '4px' }}>
                                        {tokenInfo?.symbol || selectedToken.symbol}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span style={{ 
                                        color: transfer.usdValue > 100000 ? '#ffd700' : 
                                               transfer.usdValue > 10000 ? '#10b981' : '#888', 
                                        fontWeight: '700'
                                      }}>
                                        {formatUSD(transfer.usdValue)}
                                        {transfer.usdValue > 100000 && ' 🔥'}
                                        {transfer.usdValue > 500000 && '🔥'}
                                        {transfer.usdValue > 1000000 && '🔥'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <a 
                                          href={`${network.explorer}/tx/${transfer.transaction_hash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: '#888', fontSize: '0.8rem', textDecoration: 'none' }}
                                        >
                                          {transfer.block_timestamp 
                                            ? formatTimeAgo(transfer.block_timestamp)
                                            : 'Recent'
                                          }
                                        </a>
                                        <span style={{ 
                                          fontSize: '0.6rem', 
                                          color: transfer.source === 'geckoterminal' ? '#10b981' : THEME.accent.secondary,
                                          opacity: 0.7
                                        }}>
                                          {transfer.source === 'geckoterminal' ? 'DEX' : 'Chain'}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Transaction Pagination */}
                        {processedTransfers.length > TRANSACTIONS_PER_PAGE && (
                          <Pagination 
                            currentPage={txPage}
                            totalPages={Math.ceil(processedTransfers.length / TRANSACTIONS_PER_PAGE)}
                            onPageChange={setTxPage}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Smart Money Tab — Phase 5 */}
                {!loading && activeTab === 'smartmoney' && (
                  <SmartMoneyTab selectedToken={selectedToken} holders={holders} prefetchedSmHolders={smHolders} prefetchedFlows={smFlowData} prefetchedWhoBoughtSold={smWhoBoughtSold} />
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '48px 20px 24px',
          color: '#888',
          fontSize: '0.75rem',
          borderTop: `1px solid ${THEME.border.default}`,
          marginTop: '48px'
        }}>
          <p>Data: CoinGecko • Moralis • GeckoTerminal • Nansen</p>
          <p style={{ marginTop: '6px', color: THEME.text.secondary }}>
            {tokens.length > 0 ? `${tokens.length} tokens tracked` : ''} • {Object.keys(NETWORKS).length} networks • {insights.length} insights
          </p>
        </div>
      </div>
    </div>
  );
}
