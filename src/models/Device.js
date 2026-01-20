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
  device_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  serial_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  ip_address: {
    type: DataTypes.STRING(45), // IPv6 compatible
    allowNull: false
  },
  api_key: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  faculty: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'devices',
  indexes: [
    { fields: ['device_id'] },
    { fields: ['serial_number'] },
    { fields: ['ip_address'] },
    { fields: ['is_active'] }
  ]
});

// Phase 3: Hash API key before creating device
Device.beforeCreate(async (device) => {
  if (device.api_key && !device.api_key.startsWith('$2b$')) {
    // Hash API key with 10 rounds (slightly less than passwords for performance)
    device.api_key = await bcrypt.hash(device.api_key, 10);
  }
});

// Phase 3: Hash API key before updating if changed
Device.beforeUpdate(async (device) => {
  if (device.changed('api_key') && !device.api_key.startsWith('$2b$')) {
    device.api_key = await bcrypt.hash(device.api_key, 10);
  }
});

// Phase 3: Instance method to verify API key
Device.prototype.verifyApiKey = async function (plainApiKey) {
  return await bcrypt.compare(plainApiKey, this.api_key);
};

module.exports = Device;