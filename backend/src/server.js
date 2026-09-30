const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/database');
const { seedMasterCatalog } = require('./utils/seedMasterCatalog');

const startServer = async () => {
  try {
    // Establish database connection
    await connectDB();

    // Ensure master product catalog is seeded/updated (idempotent)
    try {
      await seedMasterCatalog();
    } catch (catalogErr) {
      console.warn('[VMS Backend] Warning: Master catalog seeding skipped or errored:', catalogErr.message);
    }

    // Start Express HTTP server
    const server = app.listen(config.port, () => {
      console.log(`[VMS Backend] Server running in ${config.nodeEnv} mode on port ${config.port}`);
      console.log(`[VMS Backend] Health endpoint: http://localhost:${config.port}/api/health`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('[VMS Backend] Unhandled Rejection:', err.message);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error(`[VMS Backend] Fatal error during startup: ${error.message}`);
    process.exit(1);
  }
};

startServer();
