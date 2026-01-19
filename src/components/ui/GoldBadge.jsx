/**
 * GoldBadge - Premium visual indicator for curated Gold Layer content
 * 
 * Use this badge to highlight:
 * - Queries that use GOLD schema views
 * - Pre-built, production-ready query templates
 * - Officially curated content from the MDLH Query Library
 * 
 * Variants:
 * - default: Full badge with icon and text
 * - compact: Small icon-only indicator
 * - inline: Text badge for inline use
 * - glow: Animated version for extra emphasis
 */

import React from 'react';
import { Sparkles, Crown, Gem, Star, Zap } from 'lucide-react';

// Inject keyframes for animations
const injectGoldStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('gold-badge-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'gold-badge-styles';
  style.textContent = `
    @keyframes goldShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    
    @keyframes goldPulse {
      0%, 100% { 
        box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4),
                    0 2px 8px rgba(251, 191, 36, 0.3);
      }
      50% { 
        box-shadow: 0 0 0 4px rgba(251, 191, 36, 0),
                    0 2px 12px rgba(251, 191, 36, 0.4);
      }
    }
    
    @keyframes goldFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-2px); }
    }
    
    .gold-shimmer {
      background: linear-gradient(
        90deg,
        #f59e0b 0%,
        #fbbf24 25%,
        #fef3c7 50%,
        #fbbf24 75%,
        #f59e0b 100%
      );
      background-size: 200% auto;
      animation: goldShimmer 3s linear infinite;
      -webkit-background-clip: text;
      background-clip: text;
    }
    
    .gold-pulse {
      animation: goldPulse 2s ease-in-out infinite;
    }
    
    .gold-float {
      animation: goldFloat 3s ease-in-out infinite;
    }
    
    .gold-gradient-bg {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
    }
    
    .gold-gradient-border {
      background: linear-gradient(135deg, #fef3c7, #fbbf24, #f59e0b);
      padding: 1px;
    }
    
    .gold-text-gradient {
      background: linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `;
  document.head.appendChild(style);
};

// Initialize styles on module load
if (typeof window !== 'undefined') {
  injectGoldStyles();
}

/**
 * Main GoldBadge component
 */
export function GoldBadge({ 
  variant = 'default', 
  size = 'sm',
  animated = false,
  showIcon = true,
  label = 'Gold',
  tooltip = 'Curated Gold Layer query - production-ready and optimized',
  className = ''
}) {
  // Size configurations
  const sizes = {
    xs: { 
      badge: 'px-1.5 py-0.5 text-[9px]', 
      icon: 8,
      dot: 'w-1.5 h-1.5'
    },
    sm: { 
      badge: 'px-2 py-0.5 text-[10px]', 
      icon: 10,
      dot: 'w-2 h-2'
    },
    md: { 
      badge: 'px-2.5 py-1 text-xs', 
      icon: 12,
      dot: 'w-2.5 h-2.5'
    },
    lg: { 
      badge: 'px-3 py-1.5 text-sm', 
      icon: 14,
      dot: 'w-3 h-3'
    }
  };
  
  const sizeConfig = sizes[size] || sizes.sm;
  const animationClass = animated ? 'gold-pulse gold-float' : '';
  
  // Variant: Compact (icon only)
  if (variant === 'compact') {
    return (
      <span
        className={`
          inline-flex items-center justify-center
          ${sizeConfig.dot} rounded-full
          gold-gradient-bg
          shadow-sm shadow-amber-500/30
          ${animationClass}
          ${className}
        `}
        title={tooltip}
      >
        {showIcon && <Sparkles size={sizeConfig.icon - 4} className="text-white" />}
      </span>
    );
  }
  
  // Variant: Dot (minimal indicator)
  if (variant === 'dot') {
    return (
      <span
        className={`
          inline-block ${sizeConfig.dot} rounded-full
          gold-gradient-bg
          shadow-sm shadow-amber-500/30
          ${animationClass}
          ${className}
        `}
        title={tooltip}
      />
    );
  }
  
  // Variant: Inline (text-style badge)
  if (variant === 'inline') {
    return (
      <span
        className={`
          inline-flex items-center gap-1
          font-semibold gold-text-gradient
          ${className}
        `}
        title={tooltip}
      >
        {showIcon && <Sparkles size={sizeConfig.icon} className="text-amber-500" />}
        <span>{label}</span>
      </span>
    );
  }
  
  // Variant: Glow (animated emphasis)
  if (variant === 'glow') {
    return (
      <span
        className={`
          inline-flex items-center gap-1.5
          ${sizeConfig.badge}
          font-bold uppercase tracking-wide
          gold-gradient-bg text-white
          rounded-full
          shadow-lg shadow-amber-500/40
          gold-pulse
          ${className}
        `}
        title={tooltip}
      >
        {showIcon && <Sparkles size={sizeConfig.icon} className="text-white" />}
        <span>{label}</span>
      </span>
    );
  }
  
  // Variant: Outlined
  if (variant === 'outlined') {
    return (
      <span
        className={`
          inline-flex items-center gap-1
          ${sizeConfig.badge}
          font-semibold uppercase tracking-wide
          text-amber-700 bg-amber-50
          border border-amber-300
          rounded-full
          ${animationClass}
          ${className}
        `}
        title={tooltip}
      >
        {showIcon && <Sparkles size={sizeConfig.icon} className="text-amber-500" />}
        <span>{label}</span>
      </span>
    );
  }
  
  // Variant: Premium (with gradient border)
  if (variant === 'premium') {
    return (
      <span className={`gold-gradient-border rounded-full ${animationClass} ${className}`}>
        <span
          className={`
            inline-flex items-center gap-1.5
            ${sizeConfig.badge}
            font-bold uppercase tracking-wide
            bg-white text-amber-700
            rounded-full
          `}
          title={tooltip}
        >
          {showIcon && <Crown size={sizeConfig.icon} className="text-amber-500" />}
          <span>{label}</span>
        </span>
      </span>
    );
  }
  
  // Default variant
  return (
    <span
      className={`
        inline-flex items-center gap-1
        ${sizeConfig.badge}
        font-semibold uppercase tracking-wide
        gold-gradient-bg text-white
        rounded-full
        shadow-sm shadow-amber-500/25
        ${animationClass}
        ${className}
      `}
      title={tooltip}
    >
      {showIcon && <Sparkles size={sizeConfig.icon} />}
      <span>{label}</span>
    </span>
  );
}

/**
 * GoldQueryIndicator - Shows when a query uses Gold Layer tables
 */
export function GoldQueryIndicator({ 
  tables = [], 
  showTables = true,
  size = 'sm' 
}) {
  if (!tables || tables.length === 0) return null;
  
  const goldTables = tables.filter(t => 
    t?.toUpperCase().startsWith('GOLD.') || 
    t?.toUpperCase().includes('.GOLD.')
  );
  
  if (goldTables.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2">
      <GoldBadge size={size} />
      {showTables && (
        <span className="text-xs text-amber-600 font-mono">
          {goldTables.slice(0, 2).map(t => t.split('.').pop()).join(', ')}
          {goldTables.length > 2 && ` +${goldTables.length - 2}`}
        </span>
      )}
    </div>
  );
}

/**
 * GoldLayerBanner - Prominent banner for Gold Layer sections
 */
export function GoldLayerBanner({ 
  title = 'Gold Layer Queries',
  subtitle = 'Curated, production-ready queries using optimized GOLD schema views',
  onExplore,
  compact = false
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 gold-gradient-bg rounded-lg shadow-lg shadow-amber-500/25">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900 text-sm">{title}</h4>
            <p className="text-xs text-amber-700">{subtitle}</p>
          </div>
        </div>
        {onExplore && (
          <button
            onClick={onExplore}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 
              bg-white hover:bg-amber-50 border border-amber-300 rounded-lg transition-colors"
          >
            Explore
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 rounded-2xl">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-yellow-200/30 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative flex items-start gap-4">
        <div className="p-3 gold-gradient-bg rounded-xl shadow-lg shadow-amber-500/30 gold-float">
          <Sparkles size={24} className="text-white" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold gold-text-gradient">{title}</h3>
            <GoldBadge variant="outlined" size="xs" label="Curated" showIcon={false} />
          </div>
          <p className="text-sm text-amber-800 mb-4">{subtitle}</p>
          
          <div className="flex flex-wrap gap-2">
            {['GOLD.ASSETS', 'GOLD.FULL_LINEAGE', 'GOLD.GLOSSARY_DETAILS'].map(table => (
              <span 
                key={table}
                className="px-2 py-1 text-[10px] font-mono font-medium text-amber-700 bg-white/80 border border-amber-200 rounded"
              >
                {table}
              </span>
            ))}
            <span className="px-2 py-1 text-[10px] font-medium text-amber-600">
              +9 more tables
            </span>
          </div>
        </div>
        
        {onExplore && (
          <button
            onClick={onExplore}
            className="px-4 py-2 text-sm font-semibold text-white gold-gradient-bg 
              rounded-lg shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 
              transition-all duration-200 hover:-translate-y-0.5"
          >
            Explore Queries
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * GoldRecommendationCard - Card for recommending Gold alternatives
 */
export function GoldRecommendationCard({
  originalQuery,
  goldQuery,
  onUseGold,
  onDismiss
}) {
  return (
    <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="p-2 gold-gradient-bg rounded-lg flex-shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-amber-900">
              Gold Layer Alternative Available
            </span>
            <GoldBadge variant="compact" size="xs" />
          </div>
          <p className="text-xs text-amber-700 mb-3">
            A curated, optimized version of this query exists in the Gold Layer.
          </p>
          
          {goldQuery && (
            <div className="p-2 bg-white/80 rounded border border-amber-200 mb-3">
              <p className="text-xs font-medium text-amber-800 mb-1">
                {goldQuery.name || goldQuery.label}
              </p>
              <p className="text-[10px] text-amber-600">
                {goldQuery.description}
              </p>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button
              onClick={onUseGold}
              className="px-3 py-1.5 text-xs font-medium text-white gold-gradient-bg 
                rounded-lg shadow-sm hover:shadow-md transition-all"
            >
              Use Gold Query
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-xs text-amber-600 hover:text-amber-800 transition-colors"
              >
                Keep Original
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * isGoldLayerQuery - Helper to detect if a query uses Gold Layer tables
 */
export function isGoldLayerQuery(sql) {
  if (!sql) return false;
  const upperSQL = sql.toUpperCase();
  return upperSQL.includes('GOLD.') || 
         upperSQL.includes('FROM GOLD') ||
         upperSQL.includes('JOIN GOLD');
}

/**
 * getGoldTablesFromQuery - Extract Gold table names from SQL
 */
export function getGoldTablesFromQuery(sql) {
  if (!sql) return [];
  
  const goldTablePattern = /GOLD\.(\w+)/gi;
  const matches = [...sql.matchAll(goldTablePattern)];
  const tables = [...new Set(matches.map(m => `GOLD.${m[1].toUpperCase()}`))];
  
  return tables;
}

export default GoldBadge;
