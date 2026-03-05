import { CACHE_TTL } from '../utils/constants.js';

// ============================================
// CACHE MANAGER
// ============================================

export const CacheManager = {
  get: (key) => {
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (!cached) return null;
      
      const { data, timestamp, ttl } = JSON.parse(cached);
      if (Date.now() - timestamp > ttl) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },
  
  set: (key, data, ttl = CACHE_TTL) => {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl
      }));
    } catch (e) {
      console.warn('Cache storage full, clearing old entries');
      CacheManager.clearOld();
    }
  },
  
  clearOld: () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    keys.forEach(key => {
      try {
        const { timestamp, ttl } = JSON.parse(localStorage.getItem(key) || '{}');
        if (!timestamp || Date.now() - timestamp > ttl) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  }
};

// ============================================
// SNAPSHOT MANAGER
// ============================================

export const SnapshotManager = {
  getKey: (tokenAddress, chain) => `snapshot_${chain}_${tokenAddress}`,
  
  save: (tokenAddress, chain, holders) => {
    const key = SnapshotManager.getKey(tokenAddress, chain);
    const existing = SnapshotManager.getAll(tokenAddress, chain);
    
    const newSnapshot = {
      timestamp: Date.now(),
      holders: holders.map(h => ({
        address: h.owner_address,
        balance: parseFloat(h.balance_formatted || h.balance) || 0,
        percentage: parseFloat(h.percentage_relative_to_total_supply) || 0
      }))
    };
    
    // Keep last 5 snapshots
    const snapshots = [...existing, newSnapshot].slice(-5);
    
    try {
      localStorage.setItem(key, JSON.stringify(snapshots));
    } catch {
      localStorage.setItem(key, JSON.stringify([newSnapshot]));
    }
    
    return snapshots;
  },
  
  getAll: (tokenAddress, chain) => {
    const key = SnapshotManager.getKey(tokenAddress, chain);
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  },
  
  getLatest: (tokenAddress, chain) => {
    const snapshots = SnapshotManager.getAll(tokenAddress, chain);
    return snapshots[snapshots.length - 1] || null;
  },
  
  getPrevious: (tokenAddress, chain) => {
    const snapshots = SnapshotManager.getAll(tokenAddress, chain);
    return snapshots[snapshots.length - 2] || null;
  },
  
  compareSnapshots: (current, previous) => {
    if (!previous || !current) return { newWhales: [], exitedWhales: [], changes: {} };
    
    const prevMap = new Map(previous.holders.map(h => [h.address, h]));
    const currMap = new Map(current.holders.map(h => [h.address, h]));
    
    const newWhales = [];
    const exitedWhales = [];
    const changes = {};
    
    current.holders.forEach(holder => {
      const prev = prevMap.get(holder.address);
      if (!prev) {
        newWhales.push(holder.address);
      } else {
        const change = prev.balance > 0 
          ? ((holder.balance - prev.balance) / prev.balance) * 100 
          : 0;
        if (Math.abs(change) > 0.01) {
          changes[holder.address] = {
            previousBalance: prev.balance,
            currentBalance: holder.balance,
            changePercent: change
          };
        }
      }
    });
    
    previous.holders.forEach(holder => {
      if (!currMap.has(holder.address)) {
        exitedWhales.push(holder.address);
      }
    });
    
    return { newWhales, exitedWhales, changes };
  }
};
