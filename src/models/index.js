// src/models/index.js - Centralized Model Exports (Prisma Version)
// CLEAN ARCHITECTURE: Exports only the Prisma instance.
// Legacy Sequelize models have been archived to /src/models/legacy/

const { prisma } = require('../utils/prismaHelpers');

// Export Prisma Client instance
// Usages: const { prisma } = require('../models');
module.exports = {
  prisma
};