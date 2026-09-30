import React, { useState, useEffect, useRef, useCallback } from 'react';
import masterProductService from '../../services/masterProductService';
import { getImageUrl } from '../../utils/imageUrl';

/**
 * ProductCatalogSelector
 * Searchable product selector supporting:
 *  - Local Master Catalog (always available)
 *  - Live External Marketplace Search (RapidAPI / SerpApi fallback)
 * Automatically caches selected external products into the Master Catalog.
 */
export const ProductCatalogSelector = ({
  onSelectProduct,
  selectedProduct = null,
  selectedVariant = null,
  onClear = null,
  placeholder = 'Search products — local catalog + live marketplace...',
  filterCategory = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(filterCategory || 'ALL');
  const [categories, setCategories] = useState([]);
  const [selectedVar, setSelectedVar] = useState(selectedVariant);

  // Live external search state (defaults to true for real Axesso Amazon India integration)
  const [liveMode, setLiveMode] = useState(true);
  const [liveProvider, setLiveProvider] = useState('');
  const [cachingId, setCachingId] = useState(null); // track which item is being cached

  // Price refresh state (shown on selected-pill)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedPrice, setRefreshedPrice] = useState(null);

  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // ─── Load categories on mount ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    masterProductService
      .getCategoriesAndBrands()
      .then((res) => {
        if (mounted && res?.data?.categories) setCategories(res.data.categories);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // ─── Click outside to close ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Debounced search ────────────────────────────────────────────────────────
  const doSearch = useCallback(async (term, tab, live) => {
    setLoading(true);
    setLiveProvider('');
    try {
      if (live && term.trim().length >= 2) {
        // ── Live External Search ──
        const res = await masterProductService.searchExternal(term.trim(), {
          category: tab && tab !== 'ALL' ? tab : undefined,
          limit: 20,
        });
        setResults(res?.data || []);
        setLiveProvider(res?.provider || 'external');
      } else {
        // ── Local Catalog Search ──
        const params = { limit: 30 };
        if (term.trim()) params.search = term.trim();
        if (tab && tab !== 'ALL') params.category = tab;
        const res = await masterProductService.getAll(params);
        setResults(res?.data || []);
        setLiveProvider('catalog');
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(searchTerm, activeTab, liveMode);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, activeTab, liveMode, isOpen, doSearch]);

  // ─── Select an item ──────────────────────────────────────────────────────────
  const handleSelectItem = async (item, variant = null) => {
    setSelectedVar(variant);
    setIsOpen(false);
    setRefreshedPrice(null);

    let finalItem = item;

    // If this came from an external API (no MongoDB _id yet), cache it first
    if (liveMode && (!item._id || item._isExternal)) {
      setCachingId(item.externalProductId || item.productName);
      try {
        const cached = await masterProductService.cacheExternal(item);
        if (cached?.data) finalItem = cached.data;
      } catch {
        // If caching fails, still proceed with original item
      } finally {
        setCachingId(null);
      }
    }

    if (onSelectProduct) onSelectProduct(finalItem, variant);
  };

  // ─── Refresh market price for selected product ───────────────────────────────
  const handleRefreshPrice = async () => {
    if (!selectedProduct?._id || refreshing) return;
    setRefreshing(true);
    try {
      const res = await masterProductService.refreshPrice(selectedProduct._id);
      if (res?.data?.marketPrice) {
        setRefreshedPrice(res.data.marketPrice);
      }
    } catch {
      // silently fail — price panel still shows old value
    } finally {
      setRefreshing(false);
    }
  };

  const handleClear = () => {
    setSelectedVar(null);
    setSearchTerm('');
    setRefreshedPrice(null);
    if (onClear) onClear();
  };

  // ─── Provider Badge ──────────────────────────────────────────────────────────
  const ProviderBadge = ({ provider }) => {
    const map = {
      axesso: { label: 'Amazon India (Axesso)', color: '#c2410c', bg: '#fff7ed' },
      catalog: { label: 'Master Catalog', color: '#1e3a8a', bg: '#dbeafe' },
      external: { label: 'Axesso Live', color: '#ea580c', bg: '#fff7ed' },
    };
    const p = map[provider] || { label: 'Amazon India', color: '#c2410c', bg: '#fff7ed' };
    return (
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: p.bg,
          color: p.color,
          border: `1px solid ${p.color}40`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        <span>🛒</span>
        {p.label}
      </span>
    );
  };

  // ─── Selected Product Pill ──────────────────────────────────────────────────
  if (selectedProduct && !isOpen) {
    const displayName = selectedProduct.productName || selectedProduct.name;
    const refPrice = selectedVar?.referencePrice || selectedProduct.referencePrice || 0;
    const mktPrice = refreshedPrice || selectedProduct.marketPrice || (refPrice > 0 ? refPrice : 0);
    const asin = selectedProduct.asin || selectedProduct.externalProductId;
    const hasLivePrice = mktPrice > 0;

    return (
      <div
        style={{
          border: '1.5px solid #ea580c',
          backgroundColor: '#fffaf5',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-3) var(--spacing-4)',
          marginBottom: 'var(--spacing-4)',
          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-3)' }}>
          {/* Left: Image + Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flex: 1, minWidth: 0 }}>
            {selectedProduct.imageUrl ? (
              <img
                src={getImageUrl(selectedProduct.imageUrl)}
                alt={displayName}
                style={{
                  width: '56px',
                  height: '56px',
                  objectFit: 'contain',
                  backgroundColor: '#ffffff',
                  border: '1px solid #fed7aa',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px',
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                📦
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                <ProviderBadge provider={selectedProduct.externalProvider || 'axesso'} />
                {asin && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    ASIN: {asin}
                  </span>
                )}
                {selectedProduct.brand && (
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    Brand: <strong>{selectedProduct.brand}</strong>
                  </span>
                )}
                {selectedProduct.rating && (
                  <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
                    ★ {selectedProduct.rating}
                    {selectedProduct.reviewCount > 0 && (
                      <span style={{ color: '#64748b', fontWeight: 500, marginLeft: '3px' }}>
                        ({selectedProduct.reviewCount.toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: '1.3' }}>
                {displayName}
                {selectedVar && (
                  <span style={{ marginLeft: '6px', color: 'var(--color-primary)', fontWeight: 700 }}>
                    ({selectedVar.name || `${selectedVar.color || ''} ${selectedVar.storage || ''}`.trim()})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                {hasLivePrice ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Amazon Market Price:{' '}
                    <strong style={{ color: '#c2410c', fontSize: '13px' }}>
                      ₹{mktPrice.toLocaleString('en-IN')}
                    </strong>
                    {refreshedPrice && (
                      <span style={{ fontSize: '10px', color: '#16a34a', marginLeft: '5px', fontWeight: 700 }}>
                        ● Live Refreshed
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                    Market Price: Unavailable
                  </span>
                )}

                {selectedProduct.mrp > 0 && selectedProduct.mrp !== mktPrice && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Retail/MRP:{' '}
                    <span style={{ textDecoration: 'line-through' }}>
                      ₹{selectedProduct.mrp.toLocaleString('en-IN')}
                    </span>
                  </span>
                )}

                {selectedProduct.deliveryMessage && (
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                    🚚 {selectedProduct.deliveryMessage}
                  </span>
                )}

                {/* Refresh Live Price Button */}
                {selectedProduct._id && (
                  <button
                    type="button"
                    onClick={handleRefreshPrice}
                    disabled={refreshing}
                    title="Fetch latest live market price from Amazon India via Axesso"
                    style={{
                      padding: '2px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: refreshing ? '#f3f4f6' : '#fff7ed',
                      border: '1px solid #fdba74',
                      borderRadius: '8px',
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                      color: '#c2410c',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {refreshing ? '⏳' : '🔄'} {refreshing ? 'Refreshing…' : 'Refresh Live Price'}
                  </button>
                )}

                {/* Amazon Link */}
                {asin && (
                  <a
                    href={`https://www.amazon.in/dp/${asin}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: '11px',
                      color: '#0284c7',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    View on Amazon.in ↗
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              style={{
                padding: '4px 10px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-primary)',
              }}
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '4px 10px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid #fca5a5',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: '#dc2626',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Search Dropdown ─────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 'var(--spacing-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-1)' }}>
        <label style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-main)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Select from Master Catalog / Live Marketplace (Auto-fill specs &amp; image)
        </label>

        {/* Live Search Toggle */}
        <button
          type="button"
          onClick={() => { setLiveMode((p) => !p); setResults([]); }}
          title={liveMode ? 'Switch to local catalog search' : 'Enable live Amazon India product search (Axesso)'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', fontSize: '11px', fontWeight: 700,
            borderRadius: '12px', cursor: 'pointer',
            border: `1px solid ${liveMode ? '#ea580c' : 'var(--color-border)'}`,
            backgroundColor: liveMode ? '#ea580c' : '#ffffff',
            color: liveMode ? '#ffffff' : 'var(--color-text-muted)',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '12px' }}>🛒</span>
          {liveMode ? 'Axesso Live Search ON' : 'Catalog Only'}
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); if (!isOpen) setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={liveMode ? '🌐 Live search — e.g. Dell Latitude, iPhone 15, HP Pavilion…' : placeholder}
          style={{
            width: '100%',
            padding: '0.625rem 2.75rem 0.625rem 0.875rem',
            border: isOpen
              ? `1.5px solid ${liveMode ? '#7c3aed' : 'var(--color-primary)'}`
              : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-main)',
            boxShadow: isOpen
              ? `0 0 0 3px ${liveMode ? 'rgba(124,58,237,0.12)' : 'rgba(30, 58, 138, 0.1)'}`
              : 'none',
            outline: 'none',
          }}
        />
        <div style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', fontSize: '0.9rem',
        }}>
          {loading ? '⏳' : liveMode ? '🌐' : '🔍'}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#ffffff', border: `1px solid ${liveMode ? '#c4b5fd' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)', boxShadow: '0 12px 30px -5px rgba(0,0,0,0.15)',
          maxHeight: '400px', overflowY: 'auto', zIndex: 1200,
        }}>

          {/* Header: Mode info + Category pills */}
          <div style={{
            padding: '8px 12px 6px', backgroundColor: liveMode ? '#faf5ff' : 'var(--color-bg)',
            borderBottom: `1px solid ${liveMode ? '#e9d5ff' : 'var(--color-border)'}`,
          }}>
            {/* Mode indicator row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {liveMode ? (
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700 }}>
                    🌐 Live External Search — real-time product data from marketplace APIs
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    📋 Local Master Catalog
                  </span>
                )}
                {liveProvider && results.length > 0 && <ProviderBadge provider={liveProvider} />}
              </div>
              {results.length > 0 && (
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Category pills */}
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {['ALL', ...categories].map((cat) => (
                <button key={cat} type="button" onClick={() => setActiveTab(cat)}
                  style={{
                    padding: '2px 8px', fontSize: '11px', borderRadius: '12px',
                    border: `1px solid ${activeTab === cat ? (liveMode ? '#7c3aed' : 'var(--color-primary)') : 'var(--color-border)'}`,
                    backgroundColor: activeTab === cat ? (liveMode ? '#7c3aed' : 'var(--color-primary)') : '#ffffff',
                    color: activeTab === cat ? '#ffffff' : 'var(--color-text-muted)',
                    cursor: 'pointer', fontWeight: 600,
                  }}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>
                {liveMode ? '🌐' : '🔍'}
              </span>
              {liveMode ? 'Searching live marketplaces…' : 'Searching catalog…'}
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>📦</span>
              <div style={{ color: 'var(--color-text-muted)' }}>
                {liveMode
                  ? 'No live results. Check API key or try different keywords.'
                  : 'No catalog products found.'}
              </div>
              {!liveMode && (
                <button type="button" onClick={() => setLiveMode(true)}
                  style={{ marginTop: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 700,
                    backgroundColor: '#7c3aed', color: '#ffffff', border: 'none',
                    borderRadius: '8px', cursor: 'pointer' }}>
                  🌐 Try Live Search
                </button>
              )}
            </div>
          ) : (
            <div>
              {results.map((item, idx) => {
                const itemKey = item._id || item.externalProductId || idx;
                const isBeingCached = cachingId === (item.externalProductId || item.productName);
                return (
                  <div key={itemKey}
                    style={{
                      padding: 'var(--spacing-3)', borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer', transition: 'background-color 0.15s ease',
                      backgroundColor: isBeingCached ? '#faf5ff' : '#ffffff',
                    }}
                    onMouseEnter={(e) => { if (!isBeingCached) e.currentTarget.style.backgroundColor = liveMode ? '#faf5ff' : 'rgba(30,58,138,0.04)'; }}
                    onMouseLeave={(e) => { if (!isBeingCached) e.currentTarget.style.backgroundColor = '#ffffff'; }}
                  >
                    <div onClick={() => !isBeingCached && handleSelectItem(item)}
                      style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'flex-start' }}>

                      {/* Product Image */}
                      <div style={{ flexShrink: 0 }}>
                        {item.imageUrl ? (
                          <img src={getImageUrl(item.imageUrl)} alt={item.productName}
                            style={{ width: '52px', height: '52px', objectFit: 'contain', backgroundColor: '#ffffff',
                              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '2px' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{ width: '52px', height: '52px', backgroundColor: 'var(--color-bg)',
                            borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '1.5rem' }}>
                            📦
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + Price row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: '1.35' }}>
                            {item.productName}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            {item.marketPrice > 0 ? (
                              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#c2410c' }}>
                                ₹{item.marketPrice.toLocaleString('en-IN')}
                                <span style={{ fontSize: '9px', color: '#9ca3af', display: 'block', fontWeight: 400 }}>Amazon Live</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                Price Unavailable
                              </div>
                            )}
                            {item.referencePrice > 0 && item.referencePrice !== item.marketPrice && (
                              <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748b' }}>
                                <span style={{ textDecoration: 'line-through' }}>₹{item.referencePrice.toLocaleString('en-IN')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Meta row: Brand, ASIN, Rating, Reviews, Delivery */}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {item.brand && <span>Brand: <strong>{item.brand}</strong></span>}
                          {item.manufacturer && item.manufacturer !== item.brand && (
                            <span>Mfr: <strong>{item.manufacturer}</strong></span>
                          )}
                          {(item.asin || item.externalProductId) && (
                            <span style={{ fontSize: '10px', padding: '1px 5px', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                              ASIN: {item.asin || item.externalProductId}
                            </span>
                          )}
                          {item.rating && (
                            <span style={{ color: '#d97706', fontWeight: 700 }}>
                              ★ {item.rating}
                              {item.reviewCount > 0 && (
                                <span style={{ color: '#64748b', fontWeight: 400, marginLeft: '3px' }}>
                                  ({item.reviewCount.toLocaleString()})
                                </span>
                              )}
                            </span>
                          )}
                          {item.prime && (
                            <span style={{ fontSize: '10px', padding: '1px 5px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '4px', fontWeight: 700 }}>
                              ✓prime
                            </span>
                          )}
                          {item.deliveryMessage && (
                            <span style={{ color: '#059669', fontWeight: 500 }}>
                              🚚 {item.deliveryMessage}
                            </span>
                          )}
                          {item.externalProvider && <ProviderBadge provider={item.externalProvider} />}
                        </div>

                        {/* Specs preview */}
                        {item.specifications && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                            {item.specifications}
                          </div>
                        )}

                        {/* Amazon Store Link */}
                        {(item.asin || item.productUrl || item.externalProductUrl) && (
                          <div style={{ marginTop: '4px' }}>
                            <a
                              href={item.productUrl || item.externalProductUrl || `https://www.amazon.in/dp/${item.asin}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: '10px',
                                color: '#0284c7',
                                textDecoration: 'none',
                                padding: '2px 7px',
                                backgroundColor: '#f0f9ff',
                                borderRadius: '6px',
                                border: '1px solid #bae6fd',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontWeight: 600,
                              }}
                            >
                              <span>🔗</span> View on Amazon.in ↗
                            </a>
                          </div>
                        )}

                        {/* Caching indicator */}
                        {isBeingCached && (
                          <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '4px', fontWeight: 600 }}>
                            ⏳ Caching Amazon product to Master Catalog…
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Variant Pills */}
                    {Array.isArray(item.variants) && item.variants.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--color-border)',
                        display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          Variants:
                        </span>
                        {item.variants.map((v, vIdx) => (
                          <button key={vIdx} type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectItem(item, v); }}
                            style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer',
                              color: 'var(--color-text-main)', fontWeight: 500 }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = '#e2e8f0')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = '#f1f5f9')}>
                            {v.name || `${v.color || ''} ${v.storage || ''}`.trim()}
                            {v.referencePrice && v.referencePrice !== item.referencePrice && (
                              <span style={{ color: '#059669', marginLeft: '4px', fontWeight: 600 }}>
                                ₹{v.referencePrice.toLocaleString('en-IN')}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductCatalogSelector;
