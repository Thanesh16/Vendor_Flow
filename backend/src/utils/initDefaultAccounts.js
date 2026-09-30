/**
 * initDefaultAccounts.js
 *
 * NOTE: Automatic default account initialization during server startup has been
 * safely disabled. Existing MongoDB user accounts, roles, and credentials are the
 * absolute source of truth.
 *
 * No accounts or hardcoded passwords will be created or overwritten on startup.
 */

const initDefaultAccounts = async () => {
  // Automatic startup creation/modification is disabled
  return;
};

module.exports = initDefaultAccounts;
