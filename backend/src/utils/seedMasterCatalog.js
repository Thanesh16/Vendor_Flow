const mongoose = require('mongoose');
const { MasterProduct } = require('../models/MasterProduct');
const { Product } = require('../models/Product');
const { masterCatalogProducts } = require('./masterCatalogData');
require('dotenv').config();

const seedMasterCatalog = async () => {
  console.log('Seeding Master Product Catalog (Idempotent)...');

  const operations = masterCatalogProducts.map((item) => ({
    updateOne: {
      filter: { catalogId: item.catalogId },
      update: { $set: item },
      upsert: true,
    },
  }));

  const result = await MasterProduct.bulkWrite(operations);
  console.log(`Master Catalog Seeded: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${result.matchedCount} matched.`);

  // Gracefully link existing vendor products if they match a master catalog item (non-destructive)
  const existingProducts = await Product.find({ masterProduct: null });
  for (const prod of existingProducts) {
    // Check if name contains iPhone 15 or similar
    const matchedMaster = await MasterProduct.findOne({
      $or: [
        { productName: new RegExp(`^${prod.productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
        { tags: prod.productName.toLowerCase() },
      ],
    });

    if (matchedMaster) {
      prod.masterProduct = matchedMaster._id;
      prod.masterCatalogId = matchedMaster.catalogId;
      prod.brand = matchedMaster.brand;
      prod.model = matchedMaster.model;
      prod.referencePrice = matchedMaster.referencePrice;
      if (!prod.imageUrl && matchedMaster.imageUrl) {
        prod.imageUrl = matchedMaster.imageUrl;
      }
      await prod.save();
      console.log(`Linked existing product "${prod.productName}" to master catalog item "${matchedMaster.productName}"`);
    }
  }

  return result;
};

// If run directly from command line
if (require.main === module) {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vendor_management';
  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log('Connected to MongoDB for master catalog seeding.');
      await seedMasterCatalog();
      await mongoose.disconnect();
      console.log('Disconnected. Master catalog seed finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during master catalog seeding:', err);
      process.exit(1);
    });
}

module.exports = {
  seedMasterCatalog,
};
