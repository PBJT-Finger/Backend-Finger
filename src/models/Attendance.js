// src/models/Attendance.js - Model utama untuk data absensi
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cloud_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'ID dari cloud system'
  },
  device_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'ID perangkat fingerprint'
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Nomor Induk Pegawai'
  },
  nama: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nama lengkap pengguna'
  },
  kategori_user: {
    type: DataTypes.ENUM('DOSEN', 'KARYAWAN'),
    allowNull: false,
    comment: 'Jabatan pengguna'
  },
  tanggal_absensi: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal absensi (YYYY-MM-DD)'
  },
  waktu_absensi: {
    type: DataTypes.TIME,
    allowNull: false,
    comment: 'Waktu absensi (HH:mm:ss)'
  },
  tipe_absensi: {
    type: DataTypes.ENUM('MASUK', 'PULANG'),
    allowNull: false,
    comment: 'Tipe absensi'
  },
  verifikasi: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'SIDIK_JARI',
    comment: 'Metode verifikasi'
  },
  tanggal_upload: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Timestamp upload data'
  },
  is_deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Soft delete flag'
  }
}, {
  tableName: 'attendance',
  indexes: [
    { fields: ['user_id', 'tanggal_absensi'] },
    { fields: ['device_id'] },
    { fields: ['tipe_absensi'] },
    { fields: ['kategori_user'] }, // Gunakan nama kolom sebenarnya
    { fields: ['tanggal_upload'] },
    { fields: ['is_deleted'] },
    { fields: ['cloud_id'], unique: true }
  ],
  paranoid: true, // Aktifkan soft deletes
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

module.exports = Attendance;