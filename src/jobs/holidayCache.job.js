// src/jobs/holidayCache.job.js - Cron job untuk regenerate holiday cache
const cron = require('node-cron');
const HolidayService = require('../services/holidayService');
const { HolidayCache } = require('../models');
const logger = require('../utils/logger');

/**
 * Schedule holiday cache generation
 * Runs every year on January 1st at 00:01
 * Generates holidays for next 10 years
 */
const scheduleHolidayCacheGeneration = () => {
    // Cron: 1 0 1 1 * = 00:01 on January 1st every year
    cron.schedule('1 0 1 1 *', async () => {
        logger.info('Starting annual holiday cache generation');
        try {
            const count = await HolidayService.generateHolidayCache(10);
            logger.info(`Holiday cache generation completed: ${count} holidays for next 10 years`);
        } catch (error) {
            logger.error('Holiday cache generation failed', {
                error: error.message,
                stack: error.stack
            });
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta" // Adjust to your timezone
    });
};

/**
 * Initialize holiday cache on server startup
 * Check if cache exists for current year, if not generate
 */
const initializeHolidayCache = async () => {
    try {
        const currentYear = new Date().getFullYear();

        // Check if cache exists for current year
        const count = await HolidayCache.count({
            where: { tahun: currentYear }
        });

        if (count === 0) {
            logger.info(`Generating holiday cache for ${currentYear}...`);
            await HolidayService.generateHolidayCache(currentYear); // Assuming generateHolidayCache is in HolidayService
        }

        logger.info(`✅ Holiday cache ready (${count} records)`);
    } catch (error) {
        logger.warn('⚠️  Holiday cache unavailable - server will continue');
    }
};

module.exports = {
    scheduleHolidayCacheGeneration,
    initializeHolidayCache
};
