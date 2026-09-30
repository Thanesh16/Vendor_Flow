import React, { useState } from 'react';
import Button from '../common/Button';
import evaluationService from '../../services/evaluationService';

const RATING_CRITERIA = [
  { key: 'qualityRating', label: 'Product Quality', description: 'Satisfaction with the received items, condition, and specs' },
  { key: 'deliveryRating', label: 'Delivery Speed', description: 'Fulfillment speed, dispatch turnaround, and timeline adherence' },
  { key: 'pricingRating', label: 'Pricing / Value', description: 'Cost reasonableness, quote transparency, and budget efficiency' },
  { key: 'supportRating', label: 'Vendor Service / Support', description: 'Communication, responsiveness, and supplier professionalism' },
  { key: 'overallRating', label: 'Overall Experience', description: 'General end-to-end satisfaction with this completed procurement' },
];

export const EvaluationModal = ({ isOpen, onClose, order, onSuccess }) => {
  const [ratings, setRatings] = useState({
    qualityRating: 5,
    deliveryRating: 5,
    pricingRating: 5,
    supportRating: 5,
    overallRating: 5,
  });
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !order) return null;

  const handleRatingChange = (key, starVal) => {
    setRatings((prev) => ({ ...prev, [key]: starVal }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await evaluationService.submitEvaluation({
        purchaseOrderId: order._id,
        qualityRating: ratings.qualityRating,
        deliveryRating: ratings.deliveryRating,
        pricingRating: ratings.pricingRating,
        supportRating: ratings.supportRating,
        overallRating: ratings.overallRating,
        comments: comments.trim(),
      });

      if (response.success) {
        if (onSuccess) {
          onSuccess(response.data?.evaluation || response.data);
        }
        onClose();
      } else {
        setError(response.message || 'Failed to submit evaluation.');
      }
    } catch (err) {
      console.error('Failed to submit evaluation:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Unable to submit evaluation. Please verify connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const vendorName = order.vendor?.companyName || 'Supplier';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 1150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--color-border, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: '#0f172a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⭐</span>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Rate Your Purchase
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Order {order.poNumber} • {vendorName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                marginBottom: '1.25rem',
              }}
            >
              {error}
            </div>
          )}

          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Please evaluate your delivered items across the official procurement performance criteria.
            Your feedback directly contributes to VENDORFLOW supplier ratings.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', marginBottom: '1.5rem' }}>
            {RATING_CRITERIA.map((crit) => {
              const currentVal = ratings[crit.key];
              return (
                <div
                  key={crit.key}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                      {crit.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      {crit.description}
                    </div>
                  </div>

                  {/* 5-Star Interactive Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = star <= currentVal;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRatingChange(crit.key, star)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            lineHeight: 1,
                            padding: '2px',
                            color: isFilled ? '#f59e0b' : '#cbd5e1',
                            transition: 'transform 0.1s ease, color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                          title={`${star} star${star > 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      );
                    })}
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#475569',
                        minWidth: '24px',
                        textAlign: 'right',
                      }}
                    >
                      {currentVal}/5
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional Comments */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="eval-comments"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.375rem' }}
            >
              Order Comments / Delivery Notes (Optional)
            </label>
            <textarea
              id="eval-comments"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="e.g. Items arrived in pristine condition, timely fulfillment, smooth reception."
              maxLength={1000}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: 'var(--color-primary, #1e3a8a)' }}
            >
              {submitting ? 'Submitting Rating...' : 'Submit Evaluation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EvaluationModal;
