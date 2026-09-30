import React from 'react';

/**
 * Production-grade React Error Boundary
 * Prevents runtime exceptions from crashing the application into a blank white screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: 'var(--spacing-8)',
            maxWidth: '600px',
            margin: 'var(--spacing-12) auto',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-error-border, rgba(239, 68, 68, 0.3))',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: 'var(--spacing-3)' }}>⚠️</div>
          <h2
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 700,
              color: 'var(--color-text-main)',
              marginBottom: 'var(--spacing-2)',
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--spacing-6)',
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message ||
              'An unexpected error occurred while rendering this view. Your session and data are secure.'}
          </p>

          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-3)',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={this.handleReset}
              className="btn btn-outline btn-sm"
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              🔄 Try Again
            </button>
            <button
              type="button"
              onClick={() => (window.location.href = '/dashboard')}
              className="btn btn-primary btn-sm"
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              📊 Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
