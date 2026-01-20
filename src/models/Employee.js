// src/models/Employee.js - Model untuk master data pegawai
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nip: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Nomor Induk Pegawai'
  },
  nama: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nama lengkap pegawai'
  },
  jabatan: {
    type: DataTypes.ENUM('DOSEN', 'KARYAWAN'),
    allowNull: false,
    comment: 'Jabatan pegawai'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Departemen/Unit kerja'
  },
  fakultas: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Fakultas'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Email pegawai'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Nomor telepon'
  },
  shift_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'NULL untuk DOSEN (flexible schedule), ID shift untuk KARYAWAN'
  },
  status: {
    type: DataTypes.ENUM('AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF'),
    defaultValue: 'AKTIF',
    comment: 'Status pegawai'
  },
  tanggal_masuk: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Tanggal mulai bekerja'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Status aktif'
  }
}, {
  tableName: 'employees',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['nip'] },
    { fields: ['jabatan'] },
    { fields: ['shift_id'] },
    { fields: ['status'] },
    { fields: ['is_active'] }
  ]
});

// Associations will be defined in models/index.js
module.exports = Employee;
