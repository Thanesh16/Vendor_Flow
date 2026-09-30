import React from 'react';

/**
 * Reusable Metric KPI summary card
 */
export const MetricCard = ({
  title,
  value,
  icon,
  description,
  badge,
  className = '',
}) => {
  return (
    <div className={`metric-card ${className}`.trim()}>
      <div>
        <div className="metric-card-header">
          <span className="metric-card-title">{title}</span>
          {icon && <div className="metric-card-icon">{icon}</div>}
        </div>
        <div className="metric-card-value">
          {value !== undefined && value !== null ? value : 0}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-2)' }}>
        {description && <span className="metric-card-desc">{description}</span>}
        {badge}
      </div>
    </div>
  );
};

export default MetricCard;
