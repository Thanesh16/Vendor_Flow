import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import receiptService from '../../services/receiptService';

export const ReceiptModal = ({ isOpen, onClose, orderId, initialReceipt = null }) => {
  const [receipt, setReceipt] = useState(initialReceipt);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && orderId && !initialReceipt) {
      loadReceipt();
    } else if (isOpen && initialReceipt) {
      setReceipt(initialReceipt);
      setError('');
    }
  }, [isOpen, orderId, initialReceipt]);

  const loadReceipt = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await receiptService.getReceiptByOrderId(orderId);
      if (response.success && response.data?.receipt) {
        setReceipt(response.data.receipt);
      } else {
        setError(response.message || 'Receipt could not be loaded.');
      }
    } catch (err) {
      console.error('Failed to load receipt:', err);
      setError(err.response?.data?.message || 'Receipt not found or order is not yet delivered.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;
    setDownloading(true);
    try {
      await receiptService.downloadReceiptPdf(receipt._id, receipt.receiptNumber);
    } catch (err) {
      console.error('Failed to download receipt PDF:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Print-specific style: ensures only the receipt content prints on A4 without navbar, sidebar, buttons, or blank space */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body * {
            visibility: hidden !important;
          }
          .app-sidebar,
          .app-topbar,
          .menu-toggle-btn,
          header,
          aside,
          nav,
          .vf-no-print {
            display: none !important;
          }
          .vf-receipt-modal-backdrop {
            position: static !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .vf-receipt-modal-container {
            position: static !important;
            box-shadow: none !important;
            border: none !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            background: transparent !important;
            display: block !important;
          }
          #vf-official-receipt,
          #vf-official-receipt * {
            visibility: visible !important;
          }
          #vf-official-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div
        className="vf-receipt-modal-backdrop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(3px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-4)',
        }}
      >
        <div
          className="vf-receipt-modal-container"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="vf-no-print"
            style={{
              padding: 'var(--spacing-4) var(--spacing-6)',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
                Official Purchase Receipt
              </h2>
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.85, marginTop: '2px' }}>
                {receipt?.receiptNumber ? `Reference: ${receipt.receiptNumber}` : 'Loading receipt details...'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.25rem',
                cursor: 'pointer',
                opacity: 0.8,
                padding: '4px',
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1, backgroundColor: 'var(--color-bg)' }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-12) 0', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔄</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Loading verified purchase receipt...</div>
              </div>
            )}

            {error && !loading && (
              <div
                style={{
                  padding: 'var(--spacing-4)',
                  backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                  border: '1px solid var(--color-warning-border, #fde68a)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-warning-text, #92400e)',
                  textAlign: 'center',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <strong>Receipt Notice:</strong> {error}
              </div>
            )}

            {receipt && !loading && (
              <div
                id="vf-official-receipt"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--spacing-5)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Meta details banner */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 'var(--spacing-4)',
                    marginBottom: 'var(--spacing-4)',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-3)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Receipt Reference
                    </span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {receipt.receiptNumber}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      PO Number: <strong style={{ color: 'var(--color-text-main)' }}>{receipt.poNumber}</strong>
                      {receipt.prNumber && (
                        <span> | PR: <strong style={{ color: 'var(--color-text-main)' }}>{receipt.prNumber}</strong></span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <Badge variant="success" size="sm">
                      {receipt.status === 'DELIVERED' || receipt.deliveredAt ? 'FULFILLED & DELIVERED' : 'OFFICIALLY ISSUED'}
                    </Badge>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Issued: {new Date(receipt.issuedAt || receipt.createdAt).toLocaleDateString('en-IN')}
                    </div>
                    {receipt.deliveredAt && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Delivered: {new Date(receipt.deliveredAt).toLocaleDateString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-Column Seller / Buyer Info */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--spacing-4)',
                    marginBottom: 'var(--spacing-5)',
                  }}
                >
                  {/* Seller Box */}
                  <div
                    style={{
                      padding: 'var(--spacing-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '4px' }}>
                      Supplier / Vendor
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                      {receipt.vendorSnapshot?.companyName || 'Supplier'}
                    </div>
                    {receipt.vendorSnapshot?.contactPerson && (
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Contact: {receipt.vendorSnapshot.contactPerson}
                      </div>
                    )}
                    {receipt.vendorSnapshot?.email && (
                      <div style={{ color: 'var(--color-text-muted)' }}>Email: {receipt.vendorSnapshot.email}</div>
                    )}
                    {receipt.vendorSnapshot?.phone && (
                      <div style={{ color: 'var(--color-text-muted)' }}>Phone: {receipt.vendorSnapshot.phone}</div>
                    )}
                    {receipt.vendorSnapshot?.address && (
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {[receipt.vendorSnapshot.address, receipt.vendorSnapshot.city, receipt.vendorSnapshot.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Buyer Box */}
                  <div
                    style={{
                      padding: 'var(--spacing-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-main)', marginBottom: '4px' }}>
                      Buyer / Delivery Destination
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                      {receipt.deliverySnapshot?.contactName || receipt.employeeSnapshot?.name || 'Authorized Buyer'}
                    </div>
                    {receipt.employeeSnapshot?.email && (
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Email: {receipt.employeeSnapshot.email}
                      </div>
                    )}
                    {receipt.deliverySnapshot?.contactPhone && (
                      <div style={{ color: 'var(--color-text-muted)' }}>
                        Phone: {receipt.deliverySnapshot.contactPhone}
                      </div>
                    )}
                    {receipt.deliverySnapshot?.address && (
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Destination: {[receipt.deliverySnapshot.address, receipt.deliverySnapshot.city, receipt.deliverySnapshot.postalCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fulfilled Line Items Table */}
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                    Ordered Products (Historical Agreed Price)
                  </div>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '8px 10px', color: 'var(--color-text-muted)', width: '30px' }}>#</th>
                          <th style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>Product Description</th>
                          <th style={{ padding: '8px 10px', color: 'var(--color-text-muted)', textAlign: 'center', width: '60px' }}>Qty</th>
                          <th style={{ padding: '8px 10px', color: 'var(--color-text-muted)', textAlign: 'right', width: '100px' }}>Unit Price</th>
                          <th style={{ padding: '8px 10px', color: 'var(--color-text-muted)', textAlign: 'right', width: '110px' }}>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(receipt.items || []).map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--color-text-light)' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{it.name}</div>
                              {it.description && (
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                  {it.description}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{it.quantity}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                              ₹{Number(it.unitPrice || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)' }}>
                              ₹{Number(it.totalPrice || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-3)' }}>
                  <div
                    style={{
                      width: '240px',
                      padding: 'var(--spacing-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      <span>Subtotal:</span>
                      <span>₹{Number(receipt.subtotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--color-border)',
                        paddingTop: '6px',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                      }}
                    >
                      <span>Total Amount:</span>
                      <span>₹{Number(receipt.totalAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Authenticity Notice */}
                <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--color-text-light)', borderTop: '1px dashed var(--color-border)', paddingTop: '8px' }}>
                  Official Computer-Generated Purchase Receipt — Issued by VendorFlow Enterprise Procurement System
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer with Compact VendorFlow Action Buttons */}
          <div
            className="vf-no-print"
            style={{
              padding: 'var(--spacing-3) var(--spacing-6)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {receipt && (
              <>
                <Button variant="secondary" size="sm" onClick={handlePrint}>
                  🖨 Print
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                >
                  {downloading ? 'Generating PDF...' : '📄 Download Official PDF'}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReceiptModal;
