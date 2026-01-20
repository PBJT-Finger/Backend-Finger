// src/models/index.js - Centralized models with associations
const { sequelize } = require('../config/database');

// Import all models
const Admin = require('./Admin');
const Device = require('./Device');
const Attendance = require('./Attendance');
const Employee = require('./Employee');
const Shift = require('./Shift');
const PasswordReset = require('./PasswordReset')(sequelize);

// =====================================================
// DEFINE ASSOCIATIONS
// =====================================================

// Employee <-> Shift (Many-to-One)
// Many employees can belong to one shift
Employee.belongsTo(Shift, {
  foreignKey: 'shift_id',
  as: 'shift'
});

Shift.hasMany(Employee, {
  foreignKey: 'shift_id',
  as: 'employees'
});

// Employee <-> Attendance (One-to-Many)
// One employee has many attendance records
Employee.hasMany(Attendance, {
  foreignKey: 'user_id',  // Changed from 'nip' to 'user_id'
  sourceKey: 'nip',
  as: 'attendances'
});

Attendance.belongsTo(Employee, {
  foreignKey: 'user_id',  // Changed from 'nip' to 'user_id'
  targetKey: 'nip',
  as: 'employee'
});

// Device <-> Attendance (One-to-Many)
// One device has many attendance records
Device.hasMany(Attendance, {
  foreignKey: 'device_id',
  sourceKey: 'device_id',
  as: 'attendances'
});

Attendance.belongsTo(Device, {
  foreignKey: 'device_id',
  targetKey: 'device_id',
  as: 'device'
});

// Admin <-> PasswordReset (One-to-Many)
// One admin can have multiple password reset requests
Admin.hasMany(PasswordReset, {
  foreignKey: 'admin_id',
  as: 'passwordResets'
});

PasswordReset.belongsTo(Admin, {
  foreignKey: 'admin_id',
  as: 'admin'
});



// =====================================================
// EXPORT ALL MODELS
// =====================================================
module.exports = {
  sequelize,
  Admin,
  Device,
  Attendance,
  Employee,
  Shift,
  PasswordReset
};