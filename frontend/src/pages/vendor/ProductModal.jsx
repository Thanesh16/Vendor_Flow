import React, { useState, useEffect, useRef } from 'react';
import Button from '../../components/common/Button';
import productService from '../../services/productService';
import { getImageUrl } from '../../utils/imageUrl';

const CATEGORIES = [
  'IT Hardware',
  'Electronics',
  'Office Equipment',
  'Furniture',
  'Industrial Equipment',
  'Stationery',
  'Safety Equipment',
  'Software',
  'Other',
];

const UNITS = [
  'Units',
  'Pieces',
  'Sets',
  'Boxes',
  'Cartons',
  'Kg',
  'Litres',
  'Metres',
  'Pairs',
  'Rolls',
];

const inputStyle = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: '8px',
  border: '1.5px solid var(--color-border)',
  fontSize: 'var(--font-size-sm)',
  outline: 'none',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-main)',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--color-text-main)',
  marginBottom: '6px',
};

const sectionHeaderStyle = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--color-primary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--color-border)',
  paddingBottom: '6px',
  marginBottom: '16px',
};

const fieldGroupStyle = {
  marginBottom: '20px',
};

export const ProductModal = ({ isOpen, onClose, product = null, onProductSaved }) => {
  const isEdit = Boolean(product && product._id);

  const [productName, setProductName]             = useState('');
  const [category, setCategory]                   = useState('IT Hardware');
  const [customCategory, setCustomCategory]       = useState('');
  const [unit, setUnit]                           = useState('Units');
  const [price, setPrice]                         = useState('');
  const [availableQuantity, setAvailableQuantity] = useState('');
  const [deliveryDays, setDeliveryDays]           = useState(3);
  const [isAvailable, setIsAvailable]             = useState(true);
  const [description, setDescription]             = useState('');
  const [specifications, setSpecifications]       = useState('');
  const [imageUrl, setImageUrl]                   = useState('');
  const [imagePublicId, setImagePublicId]         = useState('');
  const [imagePreview, setImagePreview]           = useState('');
  const [uploadingImage, setUploadingImage]       = useState(false);
  const [imageInputMode, setImageInputMode]       = useState('upload');
  const [submitting, setSubmitting]               = useState(false);
  const [formError, setFormError]                 = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    if (product && product._id) {
      setProductName(product.productName || '');
      setCategory(CATEGORIES.includes(product.category) ? product.category : 'Other');
      setCustomCategory(CATEGORIES.includes(product.category) ? '' : (product.category || ''));
      setUnit(product.unit || 'Units');
      setPrice(product.price !== undefined ? product.price : '');
      setAvailableQuantity(product.availableQuantity !== undefined ? product.availableQuantity : '');
      setDeliveryDays(product.deliveryDays || 3);
      setIsAvailable(product.isAvailable !== undefined ? product.isAvailable : true);
      setDescription(product.description || '');
      setSpecifications(product.specifications || '');
      setImageUrl(product.imageUrl || '');
      setImagePublicId(product.imagePublicId || '');
      setImagePreview(product.imageUrl ? getImageUrl(product.imageUrl) : '');
      setImageInputMode(product.imageUrl ? 'url' : 'upload');
    } else {
      setProductName('');
      setCategory('IT Hardware');
      setCustomCategory('');
      setUnit('Units');
      setPrice('');
      setAvailableQuantity('');
      setDeliveryDays(3);
      setIsAvailable(true);
      setDescription('');
      setSpecifications('');
      setImageUrl('');
      setImagePublicId('');
      setImagePreview('');
      setImageInputMode('upload');
    }
    setFormError('');
  }, [product, isOpen]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setFormError('Invalid file type. Please upload JPG, PNG, WEBP, or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('File exceeds 5 MB limit.');
      return;
    }
    setUploadingImage(true);
    setFormError('');
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    try {
      const res = await productService.uploadImage(file);
      const data = res.data || res;
      if (data?.url) {
        setImageUrl(data.url);
        setImagePublicId(data.publicId || '');
        setImagePreview(data.url);
      } else {
        setFormError('Image uploaded but no URL returned. Try again.');
        setImagePreview('');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Image upload failed.');
      setImagePreview('');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUrlChange = (e) => {
    const val = e.target.value;
    setImageUrl(val);
    setImagePublicId('');
    setImagePreview(val);
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImagePublicId('');
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = productName.trim();
    if (!trimmedName) { setFormError('Product Name / Model is required.'); return; }

    const resolvedCategory = category === 'Other' ? customCategory.trim() : category;
    if (!resolvedCategory) { setFormError('Please specify a product category.'); return; }

    const priceNum = Number(price);
    if (price === '' || isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid Unit Price (0 or greater).');
      return;
    }

    const qtyNum = Number(availableQuantity);
    if (availableQuantity === '' || isNaN(qtyNum) || qtyNum < 0) {
      setFormError('Please enter a valid Available Quantity (0 or greater).');
      return;
    }

    const deliveryNum = Number(deliveryDays);
    if (!deliveryDays || isNaN(deliveryNum) || deliveryNum < 1) {
      setFormError('Delivery time must be at least 1 day.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productName: trimmedName,
        category: resolvedCategory,
        unit: unit.trim() || 'Units',
        price: priceNum,
        availableQuantity: qtyNum,
        deliveryDays: deliveryNum,
        isAvailable,
        description: description.trim(),
        specifications: specifications.trim(),
        imageUrl: imageUrl.trim(),
        imagePublicId: imagePublicId.trim(),
        images: imageUrl.trim() ? [{ url: imageUrl.trim(), publicId: imagePublicId.trim() }] : [],
        referencePrice: priceNum,
        marketPrice: priceNum,
        marketPriceStatus: 'REFERENCE',
      };

      let response;
      if (isEdit) {
        response = await productService.update(product._id, payload);
      } else {
        response = await productService.create(payload);
      }

      const savedProduct = response.data?.product || response.data;
      if (savedProduct) {
        onProductSaved(savedProduct, isEdit);
        onClose();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const resolvedPreview = imagePreview
    ? imagePreview.startsWith('blob:') ? imagePreview : getImageUrl(imagePreview)
    : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px 40px',
        overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '16px',
        width: '100%', maxWidth: '680px',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
        border: '1px solid var(--color-border)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: '16px 16px 0 0',
          background: 'linear-gradient(135deg, var(--color-primary) 0%, #1e40af 100%)',
        }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              {isEdit ? `Edit Product: ${product?.productName}` : 'Add Product to Catalog'}
            </h2>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', margin: '3px 0 0' }}>
              {isEdit ? 'Update product details, pricing, stock, and image.' : 'Enter product details, set pricing, and upload an image.'}
            </p>
          </div>
          <button type="button" onClick={() => { if (!submitting) onClose(); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '16px' }}>
            X
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(92vh - 140px)' }}>

            {formError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', fontWeight: 500 }}>
                Warning: {formError}
              </div>
            )}

            {/* Section: Product Identity */}
            <div style={sectionHeaderStyle}>Product Identity</div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="vf-productName">Product Name / Model *</label>
              <input id="vf-productName" type="text" value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Apple iPhone 15, Dell Inspiron 15 3530, HP LaserJet Pro"
                required style={inputStyle} />
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Enter the exact product name or model number as it should appear in the catalog.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle} htmlFor="vf-category">Category *</label>
                <select id="vf-category" value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {category === 'Other' && (
                  <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category" style={{ ...inputStyle, marginTop: '8px' }} />
                )}
              </div>
              <div>
                <label style={labelStyle} htmlFor="vf-unit">Unit of Measure</label>
                <select id="vf-unit" value={unit} onChange={(e) => setUnit(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Section: Pricing and Inventory */}
            <div style={sectionHeaderStyle}>Pricing and Inventory</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle} htmlFor="vf-price">Unit Price (Rs.) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>
                    Rs.
                  </span>
                  <input id="vf-price" type="number" min="0" step="any" value={price}
                    onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 59999" required
                    style={{ ...inputStyle, paddingLeft: '40px' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Your selling price per unit.</div>
              </div>
              <div>
                <label style={labelStyle} htmlFor="vf-qty">In-Stock Quantity *</label>
                <input id="vf-qty" type="number" min="0" step="1" value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(e.target.value)} placeholder="e.g. 15" required
                  style={inputStyle} />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Units available for immediate delivery.</div>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="vf-delivery">Estimated Delivery Time (Days) *</label>
              <input id="vf-delivery" type="number" min="1" step="1" value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)} placeholder="e.g. 3" required
                style={{ ...inputStyle, maxWidth: '200px' }} />
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Typical fulfilment days after order confirmation.</div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                Active and Available for Corporate Procurement
              </label>
            </div>

            {/* Section: Product Image */}
            <div style={sectionHeaderStyle}>Product Image</div>

            <div style={{ display: 'flex', gap: '0', marginBottom: '16px', border: '1.5px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', width: 'fit-content' }}>
              {['upload', 'url'].map((mode) => (
                <button key={mode} type="button"
                  onClick={() => { setImageInputMode(mode); handleRemoveImage(); }}
                  style={{ padding: '7px 18px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: imageInputMode === mode ? 'var(--color-primary)' : 'var(--color-surface)', color: imageInputMode === mode ? '#ffffff' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
                  {mode === 'upload' ? 'Upload File' : 'Image URL'}
                </button>
              ))}
            </div>

            {imageInputMode === 'upload' ? (
              <div style={fieldGroupStyle}>
                <div onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${uploadingImage ? '#93c5fd' : 'var(--color-border)'}`, borderRadius: '10px', padding: '28px 20px', textAlign: 'center', cursor: uploadingImage ? 'not-allowed' : 'pointer', backgroundColor: uploadingImage ? '#eff6ff' : 'var(--color-bg)', transition: 'all 0.15s' }}>
                  {uploadingImage ? (
                    <div>
                      <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>...</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>Uploading image...</div>
                    </div>
                  ) : resolvedPreview ? (
                    <div>
                      <img src={resolvedPreview} alt="Preview"
                        style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', marginBottom: '10px' }}
                        onError={(e) => { e.target.style.display = 'none'; }} />
                      <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Image uploaded. Click to replace.</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>IMG</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>Click to choose a file</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>JPG, PNG, WEBP, GIF - Max 5 MB</div>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileChange} style={{ display: 'none' }} />
                {resolvedPreview && !uploadingImage && (
                  <button type="button" onClick={handleRemoveImage}
                    style={{ marginTop: '8px', background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                    Remove image
                  </button>
                )}
              </div>
            ) : (
              <div style={fieldGroupStyle}>
                <label style={labelStyle} htmlFor="vf-imageUrl">Product Image URL</label>
                <input id="vf-imageUrl" type="url" value={imageUrl} onChange={handleImageUrlChange}
                  placeholder="https://example.com/product-image.jpg" style={inputStyle} />
                {resolvedPreview && (
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <img src={resolvedPreview} alt="URL Preview"
                      style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '8px', backgroundColor: '#fff' }}
                      onError={(e) => { e.target.style.display = 'none'; }} />
                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '6px' }}>Image preview loaded.</div>
                  </div>
                )}
                {resolvedPreview && (
                  <button type="button" onClick={handleRemoveImage}
                    style={{ marginTop: '6px', background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                    Clear image
                  </button>
                )}
              </div>
            )}

            {/* Section: Product Details */}
            <div style={sectionHeaderStyle}>Product Details</div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="vf-description">Product Overview and Description</label>
              <textarea id="vf-description" rows={3} value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the product - key features, use cases, and benefits."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="vf-specs">Technical Specifications</label>
              <textarea id="vf-specs" rows={4} value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                placeholder={"Storage: 128GB\nDisplay: 6.1 inch Super Retina XDR\nProcessor: Apple A16 Bionic\nBattery: 3279 mAh"}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6 }} />
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>One specification per line, or use key: value format.</div>
            </div>

          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderRadius: '0 0 16px 16px', backgroundColor: 'var(--color-surface)' }}>
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={submitting || uploadingImage}
              style={{ fontWeight: 700, minWidth: '160px' }}>
              {submitting ? (isEdit ? 'Saving...' : 'Publishing...') : (isEdit ? 'Save Changes' : 'Add Product')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
