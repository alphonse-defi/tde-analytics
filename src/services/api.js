import { API_DELAY, NETWORKS, COINGECKO_PLATFORM_MAP } from '../utils/constants.js';

// ============================================
// REQUEST QUEUE WITH ABORT SUPPORT
// ============================================

class RequestQueue {
  constructor(delay = API_DELAY) {
    this.queue = [];
    this.processing = false;
    this.delay = delay;
  }
  
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.delay));
      }
    }
    
    this.processing = false;
  }

  clear() {
    this.queue = [];
  }
}

export const apiQueue = new RequestQueue();

// ============================================
// IN-FLIGHT REQUEST DEDUPLICATION
// ============================================

const inflightRequests = new Map();

async function deduplicatedFetch(url, options = {}) {
  const key = url;
  
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }
  
  const promise = fetch(url, options)
    .then(async (res) => {
      inflightRequests.delete(key);
      return res;
    })
    .catch((err) => {
      inflightRequests.delete(key);
      throw err;
    });
  
  inflightRequests.set(key, promise);
  return promise;
}

// ============================================
// COINGECKO COIN DETAIL CACHE
// Prevents redundant fetches across fetchHolders, fetchPools, fetchTokenInfo
// ============================================

const coinDetailCache = new Map();
const COIN_DETAIL_TTL = 10 * 60 * 1000; // 10 minutes

export async function getCoinGeckoDetail(coingeckoId, signal) {
  const cached = coinDetailCache.get(coingeckoId);
  if (cached && (Date.now() - cached.timestamp < COIN_DETAIL_TTL)) {
    return cached.data;
  }

  const response = await deduplicatedFetch(
    `/api/moralis?source=coingecko&endpoint=${encodeURIComponent(`/coins/${coingeckoId}`)}`,
    { signal }
  );

  if (!response.ok) return null;
  
  const data = await response.json();
  coinDetailCache.set(coingeckoId, { data, timestamp: Date.now() });
  return data;
}

// Extract platform addresses from CoinGecko detail
export function extractPlatforms(cgData) {
  if (!cgData?.platforms) return [];
  
  const platformToChain = {
    'ethereum': 'eth',
    'arbitrum-one': 'arbitrum',
    'base': 'base',
    'polygon-pos': 'polygon',
    'binance-smart-chain': 'bsc'
  };
  
  return Object.entries(cgData.platforms)
    .filter(([platform, address]) => address && platformToChain[platform])
    .map(([platform, address]) => ({
      chain: platformToChain[platform],
      address,
      network: NETWORKS[platformToChain[platform]]
    }));
}

// ============================================
// API FETCH HELPERS
// ============================================

export async function fetchFromMoralis(endpoint, chain, signal) {
  const isSolana = chain === 'solana';
  const url = `/api/moralis?endpoint=${encodeURIComponent(endpoint)}${isSolana ? '&chain=solana' : ''}`;
  const response = await deduplicatedFetch(url, { signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }
  return response.json();
}

export async function fetchFromCoinGecko(endpoint, signal) {
  const url = `/api/moralis?source=coingecko&endpoint=${encodeURIComponent(endpoint)}`;
  const response = await deduplicatedFetch(url, { signal });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limited by CoinGecko. Data will refresh automatically.');
    }
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchFromGeckoTerminal(endpoint, signal) {
  const url = `/api/moralis?source=geckoterminal&endpoint=${encodeURIComponent(endpoint)}`;
  const response = await deduplicatedFetch(url, { signal });
  if (!response.ok) return null;
  return response.json();
}

export async function fetchFromDexScreener(endpoint, signal) {
  const url = `/api/moralis?source=dexscreener&endpoint=${encodeURIComponent(endpoint)}`;
  const response = await deduplicatedFetch(url, { signal });
  if (!response.ok) return null;
  return response.json();
}

// ============================================
// TOKEN HELPER
// ============================================

export function canFetchFromMoralis(token) {
  if (!token?.hasContractAddress || !token?.address) return false;
  
  // Solana addresses are base58 encoded, typically 32-44 characters
  if (token.chain === 'solana') {
    return token.address.length >= 32 && token.address.length <= 44;
  }
  
  // EVM addresses start with 0x
  return token.address.startsWith('0x');
}
