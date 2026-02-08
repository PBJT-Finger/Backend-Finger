// src/models/index.js - Prisma Client Export
// This file exports Prisma client for controllers that still use require('../models')

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = {
  prisma
};
