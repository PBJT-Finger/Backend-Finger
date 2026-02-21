// src/routes/adms.routes.js
const express = require('express');
const ADMSController = require('../controllers/adms.controller');

const router = express.Router();


router.get('/health', ADMSController.healthCheck);

module.exports = router;
