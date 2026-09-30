import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import vendorService from '../../services/vendorService';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { getImageUrl, isValidImageUrl } from '../../utils/imageUrl';

export const VendorProfilePage = () => {
  const { user } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [photoSourceType, setPhotoSourceType] = useState('upload'); // 'upload' | 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [inputImageUrl, setInputImageUrl] = useState('');
  const [isChangingPhoto, setIsChangingPhoto] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [mainImageLoadError, setMainImageLoadError] = useState(false);
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    taxId: '',
    businessDescription: '',
    shopImage: '',
    shopImages: [],
  });

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await vendorService.getMyProfile();
      if (response.success && response.data?.hasProfile) {
        setVendor(response.data.vendor);
        setHasProfile(true);
        setFormData({
          companyName: response.data.vendor.companyName || '',
          contactPerson: response.data.vendor.contactPerson || '',
          email: response.data.vendor.email || user?.email || '',
          phone: response.data.vendor.phone || '',
          address: response.data.vendor.address || '',
          city: response.data.vendor.city || '',
          state: response.data.vendor.state || '',
          country: response.data.vendor.country || '',
          taxId: response.data.vendor.taxId || '',
          businessDescription: response.data.vendor.businessDescription || '',
          shopImage: response.data.vendor.shopImage || '',
          shopImages: response.data.vendor.shopImages || [],
        });
      } else {
        setHasProfile(false);
        setVendor(null);
        setFormData((prev) => ({
          ...prev,
          contactPerson: user?.name || '',
          email: user?.email || '',
          shopImage: '',
          shopImages: [],
        }));
      }
    } catch (err) {
      setError(err.message || 'Unable to retrieve vendor profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedMime.includes(file.type)) {
      setError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size exceeds the 5MB limit.');
      return;
    }

    if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setError('');
    setSelectedFile(file);
    const blobUrl = URL.createObjectURL(file);
    setFilePreviewUrl(blobUrl);
    setPreviewLoadError(false);
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setInputImageUrl(val);
    setError('');
    setPreviewLoadError(false);
  };

  const handleSavePhoto = async () => {
    if (photoSourceType === 'upload') {
      if (!selectedFile) {
        setError('Please choose an image file to upload.');
        return;
      }
      setUploadingImage(true);
      setError('');
      setSuccessMsg('');
      try {
        const res = await vendorService.uploadShopImage(selectedFile, vendor?._id || '');
        const data = res.data || res;
        if (data?.url) {
          setFormData((prev) => ({
            ...prev,
            shopImage: data.url,
            shopImages: [{ url: data.url, isPrimary: true }],
          }));
          if (data.vendor) {
            setVendor(data.vendor);
          }
          setSuccessMsg('Shop photo uploaded and saved successfully!');
          setIsChangingPhoto(false);
          setSelectedFile(null);
          if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(filePreviewUrl);
          }
          setFilePreviewUrl('');
          setMainImageLoadError(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to upload shop photo.');
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      // URL Mode
      const trimmed = inputImageUrl.trim();
      if (!trimmed) {
        setError('Please enter an image URL.');
        return;
      }
      if (!isValidImageUrl(trimmed)) {
        setError('Please enter a valid image URL.');
        return;
      }
      setUploadingImage(true);
      setError('');
      setSuccessMsg('');
      try {
        const res = await vendorService.updateShopImageUrl(vendor._id, trimmed);
        const updatedVendor = res.data?.vendor || res.vendor;
        if (updatedVendor) {
          setVendor(updatedVendor);
          setFormData((prev) => ({
            ...prev,
            shopImage: updatedVendor.shopImage,
            shopImages: [{ url: updatedVendor.shopImage, isPrimary: true }],
          }));
        }
        setSuccessMsg('Shop photo URL saved successfully!');
        setIsChangingPhoto(false);
        setInputImageUrl('');
        setMainImageLoadError(false);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to save image URL.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!vendor?._id) {
      setFormData((prev) => ({ ...prev, shopImage: '', shopImages: [] }));
      return;
    }

    setUploadingImage(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await vendorService.removeShopImage(vendor._id);
      if (res.data?.vendor) {
        setVendor(res.data.vendor);
      }
      setFormData((prev) => ({ ...prev, shopImage: '', shopImages: [] }));
      setIsChangingPhoto(false);
      setSelectedFile(null);
      if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(filePreviewUrl);
      }
      setFilePreviewUrl('');
      setInputImageUrl('');
      setMainImageLoadError(false);
      setSuccessMsg('Shop photo removed successfully.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to remove shop photo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCancelChange = () => {
    setIsChangingPhoto(false);
    setSelectedFile(null);
    if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl('');
    setInputImageUrl('');
    setError('');
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (hasProfile) {
        // Update profile
        const res = await vendorService.updateVendor(vendor._id, formData);
        setVendor(res.data.vendor);
        setIsEditing(false);
        setSuccessMsg('Supplier profile updated successfully.');
      } else {
        // Create new profile
        const res = await vendorService.createVendor(formData);
        setVendor(res.data.vendor);
        setHasProfile(true);
        setIsEditing(false);
        setSuccessMsg('Onboarding application submitted successfully! Current status: PENDING.');
      }
    } catch (err) {
      setError(err.message || 'Submission failed. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">APPROVED</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="info">UNDER REVIEW</Badge>;
      case 'REJECTED':
        return <Badge variant="error">REJECTED</Badge>;
      default:
        return <Badge variant="warning">PENDING REVIEW</Badge>;
    }
  };

  const getStatusBanner = (status) => {
    switch (status) {
      case 'APPROVED':
        return {
          title: 'Supplier Account Fully Approved',
          desc: 'Your onboarding credentials and compliance details have been verified. You are qualified to receive and fulfill purchase orders.',
          variant: 'var(--color-success-bg)',
          border: 'var(--color-success-border)',
          color: 'var(--color-success)',
          icon: '✅',
        };
      case 'UNDER_REVIEW':
        return {
          title: 'Application Under Active Review',
          desc: 'A procurement manager is actively auditing your submitted details and compliance documents.',
          variant: 'var(--color-info-bg)',
          border: 'var(--color-info-border)',
          color: 'var(--color-info)',
          icon: '⏳',
        };
      case 'REJECTED':
        return {
          title: 'Application Not Approved',
          desc: 'Your supplier registration could not be verified at this time. Please contact procurement operations for further guidance.',
          variant: 'var(--color-error-bg)',
          border: 'var(--color-error-border)',
          color: 'var(--color-error)',
          icon: '❌',
        };
      default:
        return {
          title: 'Application Submitted — Pending Review',
          desc: 'Your onboarding form has been received and queued for review by our procurement specialists.',
          variant: 'var(--color-warning-bg)',
          border: 'var(--color-warning-border)',
          color: 'var(--color-warning)',
          icon: '📋',
        };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your supplier profile information...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      {/* Page Title */}
      <div style={{ marginBottom: 'var(--spacing-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            Supplier Profile & Onboarding
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Manage your legal entity information, tax identification, and corporate contact details.
          </p>
        </div>

        {hasProfile && !isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {/* Status Banner for Registered Vendors */}
      {hasProfile && vendor && (
        <div
          style={{
            backgroundColor: getStatusBanner(vendor.onboardingStatus).variant,
            border: `1px solid ${getStatusBanner(vendor.onboardingStatus).border}`,
            padding: 'var(--spacing-4) var(--spacing-6)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-4)',
          }}
        >
          <div style={{ fontSize: '1.75rem' }}>{getStatusBanner(vendor.onboardingStatus).icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: getStatusBanner(vendor.onboardingStatus).color }}>
              {getStatusBanner(vendor.onboardingStatus).title}
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', margin: 0, color: 'var(--color-text-main)', marginTop: '2px' }}>
              {getStatusBanner(vendor.onboardingStatus).desc}
            </p>
          </div>
          <div>{getStatusBadge(vendor.onboardingStatus)}</div>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
            padding: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-6)',
            fontSize: 'var(--font-size-sm)',
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
            padding: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-6)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Profile Display or Edit/Create Form */}
      {hasProfile && !isEditing ? (
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                <span style={{ fontSize: '1.25rem' }}>🏢</span>
                <span style={{ fontWeight: 600 }}>{vendor.companyName}</span>
              </div>
              {getStatusBadge(vendor.onboardingStatus)}
            </div>
          </CardHeader>
          <CardBody style={{ padding: 'var(--spacing-6)' }}>
            {/* Shop Photo Display & Controls */}
            <div style={{ marginBottom: 'var(--spacing-6)', padding: 'var(--spacing-4)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              {vendor.shopImage && !isChangingPhoto ? (
                /* Mode A: View Current Shop Photo */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                        📸 Shop / Business Photo
                      </span>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                        Visual storefront or facility photo for buyer and procurement identification.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={() => {
                          setIsChangingPhoto(true);
                          setPhotoSourceType('upload');
                          setPreviewLoadError(false);
                        }}
                      >
                        📷 Change Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={handleRemovePhoto}
                        style={{ color: 'var(--color-error)' }}
                      >
                        🗑️ Remove
                      </Button>
                    </div>
                  </div>

                  {mainImageLoadError ? (
                    <div
                      style={{
                        padding: 'var(--spacing-6) var(--spacing-4)',
                        textAlign: 'center',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px dashed var(--color-error-border, #fca5a5)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '6px' }}>⚠️</div>
                      <div style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                        Unable to load this image.
                      </div>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 var(--spacing-3) 0' }}>
                        The image URL may be unreachable. Click "Change Photo" to upload a new image or enter a valid URL.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          width: '100%',
                          maxHeight: '240px',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={getImageUrl(vendor.shopImage)}
                          alt={`${vendor.companyName} Shop`}
                          onError={() => setMainImageLoadError(true)}
                          onLoad={() => setMainImageLoadError(false)}
                          style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ marginTop: 'var(--spacing-2)', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✓</span> Current Shop Photo
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode B: Upload / Change Shop Photo */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                        📸 Shop / Business Photo
                      </span>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                        Upload an authentic storefront photo or provide a direct image URL.
                      </p>
                    </div>
                    {vendor.shopImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={handleCancelChange}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>

                  {/* Image Preview Box */}
                  <div style={{ marginBottom: 'var(--spacing-3)' }}>
                    {photoSourceType === 'upload' && filePreviewUrl ? (
                      previewLoadError ? (
                        <div
                          style={{
                            height: '140px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px dashed var(--color-error-border, #fca5a5)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-4)',
                          }}
                        >
                          <span style={{ fontSize: '28px', marginBottom: '4px' }}>⚠️</span>
                          <span style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            Unable to load this image.
                          </span>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            maxHeight: '200px',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={filePreviewUrl}
                            alt="Local File Preview"
                            onError={() => setPreviewLoadError(true)}
                            onLoad={() => setPreviewLoadError(false)}
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
                          />
                        </div>
                      )
                    ) : photoSourceType === 'url' && inputImageUrl.trim() ? (
                      previewLoadError ? (
                        <div
                          style={{
                            height: '140px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px dashed var(--color-error-border, #fca5a5)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-4)',
                          }}
                        >
                          <span style={{ fontSize: '28px', marginBottom: '4px' }}>⚠️</span>
                          <span style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            Unable to load this image.
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            Please verify the URL is a direct, accessible image link.
                          </span>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            maxHeight: '200px',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={getImageUrl(inputImageUrl.trim())}
                            alt="URL Preview"
                            onError={() => setPreviewLoadError(true)}
                            onLoad={() => setPreviewLoadError(false)}
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
                          />
                        </div>
                      )
                    ) : (
                      <div
                        style={{
                          padding: 'var(--spacing-6) var(--spacing-4)',
                          textAlign: 'center',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px dashed var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ fontSize: '32px', marginBottom: '4px' }}>🏢</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          No shop image selected
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image Source Radio Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-3)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                      Image source:
                    </span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', cursor: 'pointer', fontWeight: photoSourceType === 'upload' ? 600 : 400 }}>
                      <input
                        type="radio"
                        name="photoSourceType"
                        value="upload"
                        checked={photoSourceType === 'upload'}
                        onChange={() => {
                          setPhotoSourceType('upload');
                          setPreviewLoadError(false);
                        }}
                      />
                      Upload Image
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', cursor: 'pointer', fontWeight: photoSourceType === 'url' ? 600 : 400 }}>
                      <input
                        type="radio"
                        name="photoSourceType"
                        value="url"
                        checked={photoSourceType === 'url'}
                        onChange={() => {
                          setPhotoSourceType('url');
                          setPreviewLoadError(false);
                        }}
                      />
                      Image URL
                    </label>
                  </div>

                  {/* Source Input Control */}
                  {photoSourceType === 'upload' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap', marginBottom: 'var(--spacing-4)' }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        📁 Choose Image
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        style={{ display: 'none' }}
                        onChange={handleSelectFile}
                      />
                      {selectedFile ? (
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                          {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Supports JPG, PNG, WebP (Max 5MB). Selecting a file replaces previous selection.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 'var(--spacing-4)' }}>
                      <input
                        type="url"
                        value={inputImageUrl}
                        onChange={handleUrlChange}
                        placeholder="https://example.com/shop.jpg"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-xs)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text-main)',
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Enter a valid HTTP or HTTPS image URL
                      </div>
                    </div>
                  )}

                  {/* Save Action Buttons */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={uploadingImage || (photoSourceType === 'upload' ? !selectedFile : !inputImageUrl.trim())}
                      onClick={handleSavePhoto}
                    >
                      {uploadingImage ? 'Saving...' : '💾 Save Photo'}
                    </Button>
                    {vendor.shopImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={handleCancelChange}
                      >
                        Cancel
                      </Button>
                    )}
                    {vendor.shopImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={handleRemovePhoto}
                        style={{ color: 'var(--color-error)', marginLeft: 'auto' }}
                      >
                        🗑️ Remove Photo
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-6)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Corporate Contact Person</span>
                <p style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginTop: '2px' }}>{vendor.contactPerson}</p>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Contact Email</span>
                <p style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginTop: '2px' }}>{vendor.email}</p>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Phone Number</span>
                <p style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginTop: '2px' }}>{vendor.phone}</p>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Tax Identification Number (Tax ID)</span>
                <p style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{vendor.taxId}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Corporate Address</span>
              <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>
                {vendor.address}, {vendor.city}, {vendor.state}, {vendor.country}
              </p>
            </div>

            {vendor.businessDescription && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>Business Scope & Capabilities</span>
                <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '2px', lineHeight: 1.6 }}>
                  {vendor.businessDescription}
                </p>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-3)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
              <span>Onboarded: {new Date(vendor.createdAt).toLocaleDateString()}</span>
              <span>Last Modified: {new Date(vendor.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{hasProfile ? 'Edit Supplier Information' : 'New Supplier Onboarding Form'}</span>
              {hasProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody style={{ padding: 'var(--spacing-8)' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
                {/* Shop Photo Upload / URL in Form */}
                <div style={{ gridColumn: 'span 2', padding: 'var(--spacing-4)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--spacing-2)' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Storefront / Facility Photo (Optional)
                  </label>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--spacing-3) 0' }}>
                    Upload an authentic photo of your physical premises or enter an image URL.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
                    {formData.shopImage ? (
                      <div style={{ position: 'relative', width: '90px', height: '90px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0, backgroundColor: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={getImageUrl(formData.shopImage)}
                          alt="Shop Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const errDiv = document.getElementById('formShopImgErr');
                            if (errDiv) errDiv.style.display = 'flex';
                          }}
                        />
                        <div id="formShopImgErr" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '4px', textAlign: 'center', fontSize: '10px', color: 'var(--color-error)' }}>
                          <span>⚠️</span> Unable to load
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, shopImage: '', shopImages: [] }))}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '90px',
                          height: '90px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px dashed var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--color-surface)',
                          fontSize: '28px',
                          color: 'var(--color-text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        🏢
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingImage}
                          onClick={() => document.getElementById('formShopPhotoInput')?.click()}
                        >
                          {uploadingImage ? 'Uploading...' : '📁 Choose Image'}
                        </Button>
                        <input
                          type="file"
                          id="formShopPhotoInput"
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
                            if (!allowedMime.includes(file.type)) {
                              setError('Please select a valid image file (JPG, PNG, or WebP).');
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              setError('Image file size exceeds the 5MB limit.');
                              return;
                            }
                            setUploadingImage(true);
                            setError('');
                            try {
                              const res = await vendorService.uploadShopImage(file, vendor?._id || '');
                              const data = res.data || res;
                              if (data?.url) {
                                setFormData((prev) => ({
                                  ...prev,
                                  shopImage: data.url,
                                  shopImages: [{ url: data.url, isPrimary: true }],
                                }));
                              }
                            } catch (err) {
                              setError(err.response?.data?.message || err.message || 'Failed to upload shop photo.');
                            } finally {
                              setUploadingImage(false);
                            }
                          }}
                        />
                        {formData.shopImage && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData((prev) => ({ ...prev, shopImage: '', shopImages: [] }))}
                            style={{ color: 'var(--color-error)' }}
                          >
                            Clear Image
                          </Button>
                        )}
                      </div>
                      <input
                        type="url"
                        name="shopImage"
                        value={formData.shopImage}
                        onChange={(e) => setFormData((prev) => ({ ...prev, shopImage: e.target.value, shopImages: e.target.value ? [{ url: e.target.value, isPrimary: true }] : [] }))}
                        placeholder="Or enter direct image URL (https://...)"
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-xs)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text-main)',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                        Supports JPG, PNG, WebP (Max 5MB) or direct HTTP/HTTPS URL
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Company / Legal Entity Name *
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="e.g. Acme Industrial Technologies LLC"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Primary Contact Person *
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    placeholder="e.g. Jane Doe"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Business Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@company.com"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Tax ID / Registration Number *
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    value={formData.taxId}
                    onChange={handleChange}
                    placeholder="e.g. TAX-123456789"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Street Address *
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="100 Enterprise Boulevard, Suite 500"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Austin"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    State / Province *
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Texas"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Country *
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="United States"
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Business Description & Core Offerings
                  </label>
                  <textarea
                    name="businessDescription"
                    rows={3}
                    value={formData.businessDescription}
                    onChange={handleChange}
                    placeholder="Briefly describe your company's products, services, and operational capabilities..."
                    style={{ width: '100%', padding: '0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
                {hasProfile && (
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Submitting Application...' : hasProfile ? 'Save Changes' : 'Submit Onboarding Application'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default VendorProfilePage;
