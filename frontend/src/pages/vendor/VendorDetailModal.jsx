import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import vendorService from '../../services/vendorService';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { getImageUrl } from '../../utils/imageUrl';

export const VendorDetailModal = ({ vendor, onClose, onVendorUpdated }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [currentVendor, setCurrentVendor] = useState(vendor);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingConfirmStatus, setPendingConfirmStatus] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

  const shopPhotoUrl = currentVendor?.shopImage || currentVendor?.shopImages?.[0]?.url;

  const canEdit =
    user?.role === 'ADMIN' ||
    (user?.role === 'VENDOR' &&
      (currentVendor.createdBy?._id === user._id ||
        currentVendor.createdBy === user._id ||
        currentVendor.email === user.email));

  // Edit form state
  const [formData, setFormData] = useState({
    companyName: vendor?.companyName || '',
    contactPerson: vendor?.contactPerson || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    address: vendor?.address || '',
    city: vendor?.city || '',
    state: vendor?.state || '',
    country: vendor?.country || '',
    taxId: vendor?.taxId || '',
    businessDescription: vendor?.businessDescription || '',
  });

  if (!currentVendor) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    // Validate required fields
    if (
      !formData.companyName.trim() ||
      !formData.contactPerson.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.taxId.trim() ||
      !formData.address.trim() ||
      !formData.city.trim() ||
      !formData.state.trim() ||
      !formData.country.trim()
    ) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    try {
      const res = await vendorService.updateVendor(currentVendor._id, formData);
      if (res.success && res.data?.vendor) {
        setCurrentVendor(res.data.vendor);
        setIsEditing(false);
        setSuccessMsg('Vendor information updated successfully in MongoDB.');
        if (onVendorUpdated) {
          onVendorUpdated(res.data.vendor);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update vendor information');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setPendingConfirmStatus(null);

    try {
      const res = await vendorService.updateStatus(currentVendor._id, newStatus);
      if (res.success && res.data?.vendor) {
        setCurrentVendor(res.data.vendor);
        setSuccessMsg(`Vendor status updated to ${newStatus}.`);
        if (onVendorUpdated) {
          onVendorUpdated(res.data.vendor);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update vendor status');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeVariant = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'UNDER_REVIEW':
        return 'info';
      case 'REJECTED':
        return 'error';
      default:
        return 'warning';
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
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ fontSize: '1.25rem' }}>🏢</span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                  Supplier Dossier & Verification
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                {!isEditing && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        companyName: currentVendor.companyName || '',
                        contactPerson: currentVendor.contactPerson || '',
                        email: currentVendor.email || '',
                        phone: currentVendor.phone || '',
                        address: currentVendor.address || '',
                        city: currentVendor.city || '',
                        state: currentVendor.state || '',
                        country: currentVendor.country || '',
                        taxId: currentVendor.taxId || '',
                        businessDescription: currentVendor.businessDescription || '',
                      });
                      setIsEditing(true);
                      setError('');
                      setSuccessMsg('');
                    }}
                  >
                    Edit Info
                  </Button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    marginLeft: 'var(--spacing-2)',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </CardHeader>

          <CardBody style={{ padding: 'var(--spacing-6)' }}>
            {/* Top Showcase: Shop Image Showcase & Identity */}
            <div
              style={{
                marginBottom: 'var(--spacing-5)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
              }}
            >
              {shopPhotoUrl ? (
                imageLoadError ? (
                  <div
                    style={{
                      height: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-error)',
                      padding: 'var(--spacing-4)',
                    }}
                  >
                    <span style={{ fontSize: '28px', marginBottom: '4px' }}>⚠️</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Unable to load this image.</span>
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      minHeight: '200px',
                      maxHeight: '320px',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'zoom-in',
                    }}
                    onClick={() => setIsPhotoZoomed(true)}
                    title="Click to discover full storefront photo"
                  >
                    <img
                      src={getImageUrl(shopPhotoUrl)}
                      alt={`${currentVendor.companyName} storefront`}
                      onError={() => setImageLoadError(true)}
                      onLoad={() => setImageLoadError(false)}
                      style={{
                        width: '100%',
                        maxHeight: '320px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(4px)',
                        color: '#f8fafc',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        pointerEvents: 'none',
                      }}
                    >
                      <span>📸</span> Storefront / Shop Photo
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <span>🔍</span> View Full Size
                    </div>
                  </div>
                )
              ) : (
                <div
                  style={{
                    height: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span style={{ fontSize: '32px', marginBottom: '4px' }}>🏢</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>No shop image provided</span>
                </div>
              )}

              {/* Vendor Identification Strip */}
              <div
                style={{
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--color-surface)',
                  borderTop: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-2)',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {currentVendor.companyName}
                  </h3>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    📍 {currentVendor.city}{currentVendor.state ? `, ${currentVendor.state}` : ''}, {currentVendor.country}
                  </div>
                </div>
                <Badge variant={getBadgeVariant(currentVendor.onboardingStatus)}>
                  {currentVendor.onboardingStatus}
                </Badge>
              </div>
            </div>
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

            {successMsg && (
              <div
                style={{
                  backgroundColor: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-border)',
                  color: 'var(--color-success)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: 'var(--spacing-4)',
                }}
              >
                {successMsg}
              </div>
            )}

            {/* Confirmation Banner for Status Changes */}
            {pendingConfirmStatus && (
              <div
                style={{
                  backgroundColor: 'var(--color-warning-bg)',
                  border: '1px solid var(--color-warning-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-4)',
                  marginBottom: 'var(--spacing-4)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)', marginBottom: 'var(--spacing-2)' }}>
                  Confirm Status Change to {pendingConfirmStatus}?
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', margin: '0 0 var(--spacing-3) 0', color: 'var(--color-text-main)' }}>
                  {pendingConfirmStatus === 'APPROVED'
                    ? 'Approving this supplier will qualify them to receive and fulfill purchase orders on VENDORFLOW.'
                    : 'Rejecting this supplier will disqualify them from active procurement operations.'}
                </p>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <Button
                    variant={pendingConfirmStatus === 'APPROVED' ? 'primary' : 'outline'}
                    size="sm"
                    disabled={loading}
                    onClick={() => handleStatusChange(pendingConfirmStatus)}
                    style={pendingConfirmStatus === 'REJECTED' ? { color: 'var(--color-error)' } : {}}
                  >
                    {loading ? 'Updating...' : `Yes, Set to ${pendingConfirmStatus}`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingConfirmStatus(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Review Workflow Action Bar (View Mode Only) */}
            {!isEditing && (
              <div
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-4)',
                  marginBottom: 'var(--spacing-6)',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Onboarding Workflow (Current Status: {currentVendor.onboardingStatus})
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                  {currentVendor.onboardingStatus === 'PENDING' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={loading}
                        onClick={() => handleStatusChange('UNDER_REVIEW')}
                      >
                        {loading ? 'Updating...' : 'Move to Under Review'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => setPendingConfirmStatus('REJECTED')}
                        style={{ color: 'var(--color-error)' }}
                      >
                        Reject Application
                      </Button>
                    </>
                  )}

                  {currentVendor.onboardingStatus === 'UNDER_REVIEW' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={loading}
                        onClick={() => setPendingConfirmStatus('APPROVED')}
                      >
                        Approve Supplier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => setPendingConfirmStatus('REJECTED')}
                        style={{ color: 'var(--color-error)' }}
                      >
                        Reject Application
                      </Button>
                    </>
                  )}

                  {(currentVendor.onboardingStatus === 'APPROVED' || currentVendor.onboardingStatus === 'REJECTED') && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => handleStatusChange('UNDER_REVIEW')}
                    >
                      Re-open Review (Move to Under Review)
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* View Mode vs Edit Mode */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Tax ID / EIN *
                    </label>
                    <input
                      type="text"
                      name="taxId"
                      value={formData.taxId}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Street Address *
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      State / Province *
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Country *
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Business Description & Scope
                    </label>
                    <textarea
                      name="businessDescription"
                      rows={3}
                      value={formData.businessDescription}
                      onChange={handleInputChange}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-4)' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={loading}
                  >
                    {loading ? 'Saving Changes...' : 'Save Changes to MongoDB'}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {/* Vendor Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Primary Contact</span>
                    <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>{currentVendor.contactPerson}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Email Address</span>
                    <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>{currentVendor.email}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Phone Number</span>
                    <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>{currentVendor.phone}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Tax Identification (Tax ID)</span>
                    <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{currentVendor.taxId}</p>
                  </div>
                </div>

                {/* Address */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Business Location</span>
                  <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>
                    {currentVendor.address}, {currentVendor.city}, {currentVendor.state}, {currentVendor.country}
                  </p>
                </div>

                {/* Business Description */}
                {currentVendor.businessDescription && (
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Business Description</span>
                    <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '2px', lineHeight: 1.6 }}>
                      {currentVendor.businessDescription}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-3)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
                  <span>Created: {new Date(currentVendor.createdAt).toLocaleString()}</span>
                  <span>Last Modified: {new Date(currentVendor.updatedAt).toLocaleString()}</span>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* High-Resolution Fullscreen Photo Discovery Lightbox */}
      {isPhotoZoomed && shopPhotoUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-4)',
          }}
          onClick={() => setIsPhotoZoomed(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                marginBottom: 'var(--spacing-2)',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🏢</span>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                  {currentVendor.companyName} — Storefront & Facility Photo
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={getImageUrl(shopPhotoUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#93c5fd',
                    fontSize: 'var(--font-size-xs)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  ↗ Open Original
                </a>
                <button
                  type="button"
                  onClick={() => setIsPhotoZoomed(false)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <img
                src={getImageUrl(shopPhotoUrl)}
                alt={`${currentVendor.companyName} full storefront`}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDetailModal;
