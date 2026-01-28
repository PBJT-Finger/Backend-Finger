// src/models/Device.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  device_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nama device (human-readable)'
  },
  device_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Device ID unik (technical identifier)'
  },
  ip_address: {
    type: DataTypes.STRING(45), // IPv6 compatible
    allowNull: true,
    comment: 'IP address device'
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Lokasi fisik device'
  },
  api_key_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Hashed API key untuk autentikasi device'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Status aktif device'
  }
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['is_active'] }
  ]
});

// Hash API key before creating device
Device.beforeCreate(async (device) => {
  if (device.api_key_hash && !device.api_key_hash.startsWith('$2b$')) {
    // Hash API key with 10 rounds (slightly less than passwords for performance)
    device.api_key_hash = await bcrypt.hash(device.api_key_hash, 10);
  }
});

// Hash API key before updating if changed
Device.beforeUpdate(async (device) => {
  if (device.changed('api_key_hash') && !device.api_key_hash.startsWith('$2b$')) {
    device.api_key_hash = await bcrypt.hash(device.api_key_hash, 10);
  }
});

// Instance method to verify API key
Device.prototype.verifyApiKey = async function (plainApiKey) {
  return await bcrypt.compare(plainApiKey, this.api_key_hash);
};

module.exports = Device;