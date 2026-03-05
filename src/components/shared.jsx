import React, { useState, memo } from 'react';
import { THEME } from '../utils/theme.js';
import { NETWORKS } from '../utils/constants.js';
import { shortenAddress } from '../utils/formatters.js';

// ============================================
// COPY BUTTON
// ============================================

export const CopyButton = memo(({ text, style = {} }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '4px',
        color: copied ? '#10b981' : '#666',
        fontSize: '0.75rem',
        transition: 'all 0.2s ease',
        ...style
      }}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
});

CopyButton.displayName = 'CopyButton';

// ============================================
// ADDRESS DISPLAY
// ============================================

export const AddressDisplay = memo(({ address, chain, label, color = '#58a6ff', badges = [], clickable = true, onClick }) => {
  const network = NETWORKS[chain] || NETWORKS.eth;
  const addressPath = chain === 'solana' ? '/account/' : '/address/';
  
  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(address);
    }
  };
  
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      {onClick ? (
        <span
          onClick={handleClick}
          style={{ 
            fontFamily: 'monospace', 
            color, 
            textDecoration: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          {shortenAddress(address)}
        </span>
      ) : (
        <a
          href={`${network.explorer}${addressPath}${address}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            fontFamily: 'monospace', 
            color, 
            textDecoration: 'none',
            fontSize: '0.85rem'
          }}
        >
          {shortenAddress(address)}
        </a>
      )}
      <CopyButton text={address} />
      {label && (
        <span style={{
          background: 'rgba(123, 47, 247, 0.2)',
          color: '#a855f7',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: '600'
        }}>
          {label}
        </span>
      )}
      {badges.map((badge, idx) => (
        <span key={idx} style={{
          background: badge.bg || 'rgba(16, 185, 129, 0.2)',
          color: badge.color || '#10b981',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.6rem',
          fontWeight: '600'
        }}>
          {badge.text}
        </span>
      ))}
    </span>
  );
});

AddressDisplay.displayName = 'AddressDisplay';

// ============================================
// NETWORK BADGE
// ============================================

export const NetworkBadge = memo(({ chain, small = false }) => {
  const network = NETWORKS[chain] || NETWORKS.eth;
  return (
    <span style={{
      background: `${network.color}20`,
      color: network.color,
      padding: small ? '2px 6px' : '3px 8px',
      borderRadius: '4px',
      fontSize: small ? '0.6rem' : '0.65rem',
      fontWeight: '600',
      textTransform: 'uppercase'
    }}>
      {network.name}
    </span>
  );
});

NetworkBadge.displayName = 'NetworkBadge';

// ============================================
// LOADING SPINNER
// ============================================

export const LoadingSpinner = memo(({ size = 20 }) => (
  <div style={{
    width: size,
    height: size,
    border: `2px solid ${THEME.border.default}`,
    borderTopColor: THEME.accent.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }} />
));

LoadingSpinner.displayName = 'LoadingSpinner';

// ============================================
// PAGINATION
// ============================================

export const Pagination = memo(({ currentPage, totalPages, onPageChange }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '6px',
      marginTop: '16px'
    }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          padding: '6px 12px',
          background: THEME.bg.tertiary,
          border: `1px solid ${THEME.border.default}`,
          borderRadius: '4px',
          color: currentPage === 1 ? THEME.text.muted : THEME.text.secondary,
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          fontSize: '0.75rem',
          fontWeight: '500'
        }}
      >
        Prev
      </button>
      
      {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          style={{
            padding: '6px 10px',
            background: currentPage === page ? THEME.accent.primary : THEME.bg.tertiary,
            border: `1px solid ${currentPage === page ? THEME.accent.primary : THEME.border.default}`,
            borderRadius: '4px',
            color: currentPage === page ? '#fff' : THEME.text.secondary,
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '500'
          }}
        >
          {page}
        </button>
      ))}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          padding: '8px 16px',
          background: THEME.bg.tertiary,
          border: `1px solid ${THEME.border.default}`,
          borderRadius: '4px',
          color: currentPage === totalPages ? THEME.text.muted : THEME.text.secondary,
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          fontSize: '0.75rem',
          fontWeight: '500'
        }}
      >
        Next
      </button>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// ============================================
// TRANSACTION FILTERS
// ============================================

export const TransactionFilters = memo(({ minAmount, setMinAmount, txType, setTxType }) => (
  <div style={{
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    padding: '12px 16px',
    background: THEME.bg.secondary,
    border: `1px solid ${THEME.border.default}`,
    borderRadius: '6px',
    flexWrap: 'wrap',
    alignItems: 'center'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '0.75rem', color: THEME.text.muted }}>Min USD:</span>
      <select
        value={minAmount}
        onChange={(e) => setMinAmount(Number(e.target.value))}
        style={{
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        <option value={0}>Top 100 by Value</option>
        <option value={100}>$100+</option>
        <option value={1000}>$1K+</option>
        <option value={10000}>$10K+</option>
        <option value={50000}>$50K+</option>
        <option value={100000}>$100K+</option>
        <option value={500000}>$500K+</option>
        <option value={1000000}>$1M+</option>
      </select>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.75rem', color: THEME.text.muted }}>Type:</span>
      {[
        { id: 'all', label: 'All' },
        { id: 'buy', label: 'Buys' },
        { id: 'sell', label: 'Sells' },
        { id: 'transfer', label: 'Transfers' },
      ].map(type => (
        <button
          key={type.id}
          onClick={() => setTxType(type.id)}
          style={{
            padding: '5px 10px',
            background: txType === type.id ? THEME.accent.primary : THEME.bg.tertiary,
            border: `1px solid ${txType === type.id ? THEME.accent.primary : THEME.border.default}`,
            borderRadius: '4px',
            color: txType === type.id ? '#fff' : THEME.text.secondary,
            fontSize: '0.75rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {type.label}
        </button>
      ))}
    </div>
  </div>
));

TransactionFilters.displayName = 'TransactionFilters';

// ============================================
// SOCIAL LINKS
// ============================================

export const SocialLinks = memo(({ links }) => {
  if (!links) return null;
  const items = [
    { key: 'homepage', label: 'Website' },
    { key: 'twitter', label: 'Twitter' },
    { key: 'telegram', label: 'Telegram' },
    { key: 'discord', label: 'Discord' },
    { key: 'github', label: 'GitHub' }
  ].filter(item => links[item.key]);
  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {items.map(({ key, label }) => (
        <a key={key} href={links[key]} target="_blank" rel="noopener noreferrer"
          style={{ padding: '6px 12px', background: THEME.bg.tertiary, border: `1px solid ${THEME.border.default}`, borderRadius: '4px', color: THEME.text.secondary, textDecoration: 'none', fontSize: '0.75rem', transition: 'all 0.15s' }}>
          {label}
        </a>
      ))}
    </div>
  );
});

SocialLinks.displayName = 'SocialLinks';

// ============================================
// STAT CARD (used in SmartMoney and elsewhere)
// ============================================

export const StatCard = memo(({ icon, label, value, subValue }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '20px',
    flex: 1,
    minWidth: '140px'
  }}>
    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{icon}</div>
    <div style={{ 
      fontSize: '0.7rem', 
      color: '#888', 
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '4px'
    }}>
      {label}
    </div>
    <div style={{ 
      fontSize: '1.25rem', 
      fontWeight: '700',
      color: '#fff'
    }}>
      {value}
    </div>
    {subValue && (
      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
        {subValue}
      </div>
    )}
  </div>
));

StatCard.displayName = 'StatCard';
