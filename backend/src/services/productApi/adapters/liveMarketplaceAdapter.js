const { normalizeProduct, parseInrPrice } = require('../normalizer');

/**
 * liveMarketplaceAdapter.js
 * Queries live Indian e-commerce marketplace (Amazon.in) directly for real-time product discovery,
 * real images, specifications, and live INR pricing.
 */
class LiveMarketplaceAdapter {
  constructor() {
    this.name = 'live_marketplace_in';
  }

  isAvailable() {
    return true; // Always available as real-time Indian marketplace provider
  }

  getHeaders() {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
  }

  /**
   * Search real products on live Indian marketplace
   */
  async search(query, options = {}) {
    try {
      const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Marketplace search returned HTTP ${response.status}`,
        };
      }

      const html = await response.text();

      // Check if Captcha block
      if (html.includes('Enter the characters you see below') || html.includes('Type the characters')) {
        return {
          success: false,
          error: 'Marketplace search rate-limited by captcha',
        };
      }

      const productBlocks = html.split('data-component-type="s-search-result"');
      if (productBlocks.length <= 1) {
        return {
          success: true,
          provider: this.name,
          data: [],
        };
      }

      const maxResults = options.limit || 10;
      const normalizedItems = [];
      const seenAsins = new Set();

      for (let i = 1; i < productBlocks.length && normalizedItems.length < maxResults; i++) {
        const block = productBlocks[i];

        // ASIN identifier
        const asinMatch = block.match(/data-asin="([^"]+)"/);
        const asin = asinMatch ? asinMatch[1] : '';
        if (!asin || seenAsins.has(asin)) continue;
        seenAsins.add(asin);

        // Product Title
        let title = '';
        const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
        if (titleMatch && titleMatch[1].trim().length > 4) {
          title = titleMatch[1].trim();
        } else {
          const altTitleMatch = block.match(
            /<a class="a-link-normal s-line-clamp-[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/
          );
          if (altTitleMatch) {
            title = altTitleMatch[1].trim();
          }
        }

        // Live Market Price (whole number in INR)
        let price = 0;
        const priceMatch = block.match(/<span class="a-price-whole">([^<]+)<\/span>/);
        if (priceMatch) {
          price = parseInrPrice(priceMatch[1]);
        }

        // MRP / List Price (strikethrough price)
        let mrp = price;
        const mrpMatch = block.match(/<span class="a-price a-text-price"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/);
        if (mrpMatch) {
          mrp = parseInrPrice(mrpMatch[1]);
        }

        // High-res Image URL from Amazon CDN
        let image = '';
        const imgMatch = block.match(/<img[^>]*class="s-image"[^>]*src="([^"]+)"/);
        if (imgMatch) {
          image = imgMatch[1];
        }

        // Product Page Link
        let link = '';
        const linkMatch = block.match(/<a[^>]*class="a-link-normal s-no-outline"[^>]*href="([^"]+)"/);
        if (linkMatch) {
          link = linkMatch[1].startsWith('http')
            ? linkMatch[1]
            : `https://www.amazon.in${linkMatch[1]}`;
        }

        // Rating
        let rating = 0;
        const ratingMatch = block.match(/<span class="a-icon-alt">([\d.]+) out of 5 stars<\/span>/);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]) || 0;
        }

        // Review Count
        let reviewsCount = 0;
        const reviewsMatch = block.match(/<span class="a-size-base s-underline-text">([0-9,]+)<\/span>/);
        if (reviewsMatch) {
          reviewsCount = parseInt(reviewsMatch[1].replace(/,/g, ''), 10) || 0;
        }

        if (title && price > 0) {
          // Parse common specifications from title
          const specsObj = {};
          if (title.includes('GB') || title.includes('TB')) {
            const storageMatch = title.match(/(\d+\s*(?:GB|TB))/i);
            if (storageMatch) specsObj['Storage'] = storageMatch[1];
          }
          if (title.match(/\d+\s*GB\s*RAM/i)) {
            const ramMatch = title.match(/(\d+\s*GB)\s*RAM/i);
            if (ramMatch) specsObj['RAM'] = ramMatch[1];
          }
          if (title.match(/i[3579]-[\d\w]+/i)) {
            const cpuMatch = title.match(/(i[3579]-[\d\w]+)/i);
            if (cpuMatch) specsObj['Processor'] = cpuMatch[1];
          }
          if (title.match(/(Black|White|Blue|Green|Yellow|Pink|Titanium|Silver|Space Grey|Natural Titanium)/i)) {
            const colorMatch = title.match(/(Black|White|Blue|Green|Yellow|Pink|Titanium|Silver|Space Grey|Natural Titanium)/i);
            if (colorMatch) specsObj['Color'] = colorMatch[1];
          }
          if (rating > 0) {
            specsObj['Customer Rating'] = `${rating} / 5 (${reviewsCount.toLocaleString('en-IN')} reviews)`;
          }

          const normalized = normalizeProduct({
            rawTitle: title,
            rawBrand: '',
            rawModel: '',
            rawPrice: price,
            rawMrp: mrp,
            rawImage: image,
            rawDescription: `${title} - Live marketplace listing verified on Amazon India.`,
            rawSpecificationsObject: specsObj,
            source: 'Amazon India',
            sourceUrl: link,
            externalId: asin,
            provider: 'amazon_in_live',
            storeList: [
              {
                storeName: 'Amazon India',
                price: price,
                url: link,
                inStock: true,
              },
            ],
          });

          normalizedItems.push(normalized);
        }
      }

      return {
        success: true,
        provider: this.name,
        data: normalizedItems,
      };
    } catch (err) {
      return {
        success: false,
        error: `Live marketplace search failed: ${err.message}`,
      };
    }
  }

  /**
   * Fetch latest live price for an ASIN directly from product page
   */
  async getPrice(asin) {
    if (!asin) {
      return { success: false, error: 'ASIN is required' };
    }

    try {
      const url = `https://www.amazon.in/dp/${encodeURIComponent(asin)}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { success: false, error: `Product page returned HTTP ${response.status}` };
      }

      const html = await response.text();

      // Extract current live price
      let price = 0;
      const priceMatch =
        html.match(/<span class="a-price-whole">([^<]+)<\/span>/) ||
        html.match(/"priceAmount":\s*([\d.]+)/) ||
        html.match(/class="apexPriceToPay"[^>]*>[\s\S]*?<span class="a-offscreen">₹?([\d,]+)/);

      if (priceMatch) {
        price = parseInrPrice(priceMatch[1]);
      }

      if (!price || price <= 0) {
        return { success: false, error: 'Could not extract live price from product page' };
      }

      return {
        success: true,
        price,
        source: 'Amazon India',
        url,
        updatedAt: new Date(),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new LiveMarketplaceAdapter();
