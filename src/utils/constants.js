// ============================================
// CONFIGURATION
// ============================================

export const SNAPSHOT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in ms
export const MARKET_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes for market data
export const TOKENS_PER_PAGE = 25;
export const TRANSACTIONS_PER_PAGE = 25;
export const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours cache TTL
export const API_DELAY = 250; // Delay between API calls (ms)
export const WHALE_CHANGE_THRESHOLD = 10; // % change to trigger alert

// Supported networks
export const NETWORKS = {
  eth: { 
    name: 'Ethereum', 
    explorer: 'https://etherscan.io',
    color: '#627eea',
    coingeckoId: 'ethereum',
    geckoTerminalId: 'eth',
    dexScreenerId: 'ethereum'
  },
  arbitrum: { 
    name: 'Arbitrum', 
    explorer: 'https://arbiscan.io',
    color: '#28a0f0',
    coingeckoId: 'arbitrum-one',
    geckoTerminalId: 'arbitrum',
    dexScreenerId: 'arbitrum'
  },
  base: { 
    name: 'Base', 
    explorer: 'https://basescan.org',
    color: '#0052ff',
    coingeckoId: 'base',
    geckoTerminalId: 'base',
    dexScreenerId: 'base'
  },
  polygon: { 
    name: 'Polygon', 
    explorer: 'https://polygonscan.com',
    color: '#8247e5',
    coingeckoId: 'polygon-pos',
    geckoTerminalId: 'polygon_pos',
    dexScreenerId: 'polygon'
  },
  bsc: { 
    name: 'BNB Chain', 
    explorer: 'https://bscscan.com',
    color: '#f0b90b',
    coingeckoId: 'binance-smart-chain',
    geckoTerminalId: 'bsc',
    dexScreenerId: 'bsc'
  },
  solana: {
    name: 'Solana',
    explorer: 'https://solscan.io',
    color: '#9945ff',
    coingeckoId: 'solana',
    geckoTerminalId: 'solana',
    dexScreenerId: 'solana'
  }
};

// Map CoinGecko asset platform IDs to our network keys
export const COINGECKO_PLATFORM_MAP = {
  'ethereum': 'eth',
  'arbitrum-one': 'arbitrum',
  'base': 'base',
  'polygon-pos': 'polygon',
  'binance-smart-chain': 'bsc',
  'solana': 'solana'
};

// Reverse map: our chain keys to CoinGecko platform names
export const CHAIN_TO_PLATFORM = {
  'eth': 'ethereum',
  'arbitrum': 'arbitrum-one',
  'base': 'base',
  'polygon': 'polygon-pos',
  'bsc': 'binance-smart-chain',
  'solana': 'solana'
};
