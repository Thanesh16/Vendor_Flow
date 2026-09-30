import React from 'react';

/**
 * Reusable Status Badge component
 */
export const Badge = ({
  children,
  variant = 'neutral',
  dot = true,
  className = '',
  ...props
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()} {...props}>
      {dot && <span className="badge-dot" aria-hidden="true"></span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
