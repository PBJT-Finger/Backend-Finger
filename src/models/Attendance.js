// src/models/Attendance.js - Model untuk data absensi (UPDATED FOR PRODUCTION)
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Employee identification (denormalized for performance)
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'User ID (sama dengan NIP)'
  },
  nip: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Nomor Induk Pegawai'
  },
  nama: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nama pegawai (denormalized)'
  },
  jabatan: {
    type: DataTypes.ENUM('DOSEN', 'KARYAWAN'),
    allowNull: false,
    comment: 'Jabatan pegawai (denormalized)'
  },
  // Attendance data
  tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal absensi'
  },
  jam_masuk: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Waktu check-in pertama'
  },
  jam_keluar: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Waktu check-out terakhir'
  },
  // Device info
  device_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID device fingerprint'
  },
  cloud_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Cloud system identifier dari fingerprint device'
  },
  verification_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'SIDIK_JARI',
    comment: 'Metode verifikasi (SIDIK_JARI, KARTU, WAJAH)'
  },
  // Status tracking (HADIR / TERLAMBAT only)
  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'HADIR',
    comment: 'Status kehadiran (HADIR, TERLAMBAT)'
  },
  // Soft delete
  is_deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Soft delete flag'
  }
}, {
  tableName: 'attendance',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['nip'] },
    { fields: ['tanggal'] },
    { fields: ['jabatan'] },
    { fields: ['device_id'] },
    { fields: ['cloud_id'] },
    { fields: ['verification_method'] },
    { fields: ['status'] },
    { fields: ['is_deleted'] },
    { fields: ['nip', 'tanggal'] },
    { fields: ['tanggal', 'jabatan'] }
  ]
});

module.exports = Attendance;