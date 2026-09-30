import React, { useState } from 'react';
import Button from '../../components/common/Button';
import purchaseRequestService from '../../services/purchaseRequestService';
import ProductCatalogSelector from '../../components/common/ProductCatalogSelector';

export const CreatePurchaseRequestModal = ({ isOpen, onClose, onRequestCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [requiredDate, setRequiredDate] = useState('');
  const [items, setItems] = useState([
    {
      name: '',
      quantity: 1,
      estimatedPrice: '',
      description: '',
      category: '',
      masterProductId: null,
      masterCatalogId: '',
      referencePrice: 0,
      catalogItem: null,
      selectedVariant: null,
    },
  ]);
  const [activeSelectorIdx, setActiveSelectorIdx] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectCatalogItem = (idx, masterItem, variant = null) => {
    setItems((prev) => {
      const updated = [...prev];
      const effectiveName = variant?.name
        ? `${masterItem.productName} (${variant.name})`
        : masterItem.productName;
      const refPrice = variant?.referencePrice || masterItem.referencePrice || 0;

      updated[idx] = {
        ...updated[idx],
        name: effectiveName,
        category: masterItem.category || '',
        description: masterItem.specifications || masterItem.description || '',
        estimatedPrice: refPrice > 0 ? refPrice : updated[idx].estimatedPrice,
        masterProductId: masterItem._id,
        masterCatalogId: masterItem.catalogId,
        brand: masterItem.brand || '',
        model: masterItem.model || '',
        referencePrice: refPrice,
        catalogItem: masterItem,
        selectedVariant: variant,
      };
      return updated;
    });
    setActiveSelectorIdx(null);
  };

  const handleClearCatalogItem = (idx) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        masterProductId: null,
        masterCatalogId: '',
        brand: '',
        model: '',
        referencePrice: 0,
        catalogItem: null,
        selectedVariant: null,
      };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: '',
        quantity: 1,
        estimatedPrice: '',
        description: '',
        category: '',
        masterProductId: null,
        masterCatalogId: '',
        referencePrice: 0,
        catalogItem: null,
        selectedVariant: null,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeSelectorIdx === index) {
      setActiveSelectorIdx(null);
    }
  };

  const calculateTotal = () => {
    return items.reduce((acc, it) => {
      const q = Number(it.quantity) || 0;
      const p = Number(it.estimatedPrice) || 0;
      return acc + q * p;
    }, 0);
  };

  const handleSubmit = async (submitStatus) => {
    setError('');

    if (!title.trim()) {
      setError('Request title is required.');
      return;
    }

    if (!items || items.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].name.trim()) {
        setError(`Item #${i + 1} name is required.`);
        return;
      }
      if (!items[i].quantity || Number(items[i].quantity) < 1) {
        setError(`Item #${i + 1} quantity must be at least 1.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        priority,
        requiredDate: requiredDate || undefined,
        status: submitStatus,
        items: items.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity),
          estimatedPrice: Number(it.estimatedPrice) || 0,
          description: it.description?.trim() || '',
          category: it.category?.trim() || '',
          masterProductId: it.masterProductId || null,
          masterCatalogId: it.masterCatalogId?.trim() || '',
          brand: it.brand?.trim() || '',
          model: it.model?.trim() || '',
          referencePrice: Number(it.referencePrice) || 0,
        })),
      };

      const response = await purchaseRequestService.create(payload);
      if (response.data?.purchaseRequest) {
        onRequestCreated(response.data.purchaseRequest);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create purchase request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--spacing-4) var(--spacing-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
              New Purchase Requisition
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Submit procurement requirements for equipment, hardware, or office supplies.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--font-size-xl)',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-border)',
                color: 'var(--color-error)',
                padding: 'var(--spacing-3) var(--spacing-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: 'var(--spacing-4)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                Requisition Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5x MacBook Pro M3 for Engineering Team"
                required
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                Urgency / Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                Required By Date (Optional)
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                Business Need & Justification
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the purpose of this procurement request..."
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div style={{ marginTop: 'var(--spacing-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)' }}>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
                Requested Line Items
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                + Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 'var(--spacing-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        Item #{idx + 1}
                      </span>
                      {item.masterCatalogId && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(30, 58, 138, 0.1)',
                            color: 'var(--color-primary)',
                          }}
                        >
                          Catalog Linked [{item.masterCatalogId}]
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setActiveSelectorIdx(activeSelectorIdx === idx ? null : idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {activeSelectorIdx === idx ? 'Close Catalog Picker' : '🔍 Pick from Catalog'}
                      </button>

                      {item.masterCatalogId && (
                        <button
                          type="button"
                          onClick={() => handleClearCatalogItem(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#d97706',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer',
                          }}
                        >
                          Unlink
                        </button>
                      )}

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-error)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Render Catalog Selector if active for this item */}
                  {activeSelectorIdx === idx && (
                    <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                      <ProductCatalogSelector
                        onSelectProduct={(masterItem, variant) => handleSelectCatalogItem(idx, masterItem, variant)}
                        onClear={() => handleClearCatalogItem(idx)}
                        selectedProduct={item.catalogItem}
                        selectedVariant={item.selectedVariant}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: 'var(--spacing-2)' }}>
                    <div>
                      <input
                        type="text"
                        placeholder="Item name / model *"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          backgroundColor: 'var(--color-surface)',
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty *"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          backgroundColor: 'var(--color-surface)',
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Est. Unit Price (₹)"
                        value={item.estimatedPrice}
                        onChange={(e) => handleItemChange(idx, 'estimatedPrice', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          backgroundColor: 'var(--color-surface)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Specifications / notes (optional)"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.375rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                        backgroundColor: 'var(--color-surface)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Total Calculation Display */}
            <div
              style={{
                marginTop: 'var(--spacing-3)',
                padding: 'var(--spacing-3)',
                backgroundColor: 'rgba(30, 58, 138, 0.05)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)' }}>
                Total Estimated Cost:
              </span>
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-primary)' }}>
                ₹{calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--spacing-4) var(--spacing-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit('DRAFT')}
              disabled={submitting}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit('SUBMITTED')}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Requisition'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePurchaseRequestModal;
