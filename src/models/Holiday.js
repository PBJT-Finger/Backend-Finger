// src/models/Holiday.js - Model untuk master rules hari libur perpetual
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Holiday = sequelize.define('Holiday', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nama_libur: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nama hari libur'
    },
    deskripsi: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Deskripsi lengkap'
    },
    holiday_type: {
        type: DataTypes.ENUM('FIXED', 'LUNAR', 'FORMULA'),
        allowNull: false,
        comment: 'FIXED: tanggal tetap, LUNAR: kalender Hijriyah, FORMULA: rumus perhitungan'
    },
    // For FIXED holidays
    bulan: {
        type: DataTypes.TINYINT,
        allowNull: true,
        comment: '1-12, digunakan untuk hari libur tanggal tetap'
    },
    hari: {
        type: DataTypes.TINYINT,
        allowNull: true,
        comment: '1-31, digunakan untuk hari libur tanggal tetap'
    },
    // For LUNAR holidays (Hijri calendar)
    hijri_month: {
        type: DataTypes.TINYINT,
        allowNull: true,
        comment: '1-12 bulan Hijriyah'
    },
    hijri_day: {
        type: DataTypes.TINYINT,
        allowNull: true,
        comment: '1-30 hari Hijriyah'
    },
    // For FORMULA holidays
    formula_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Kode untuk menghitung tanggal (EASTER, NYEPI, VESAK, etc.)'
    },
    // Metadata
    tipe: {
        type: DataTypes.ENUM('NASIONAL', 'CUTI_BERSAMA', 'HARI_RAYA', 'KAMPUS'),
        allowNull: false,
        comment: 'Tipe hari libur'
    },
    tahun_mulai: {
        type: DataTypes.INTEGER,
        defaultValue: 2026,
        comment: 'Tahun mulai libur ini berlaku'
    },
    tahun_akhir: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'NULL = perpetual (berlaku selamanya)'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Status aktif'
    }
}, {
    tableName: 'holidays',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['holiday_type'] },
        { fields: ['tipe'] },
        { fields: ['is_active'] },
        { fields: ['tahun_mulai', 'tahun_akhir'] }
    ]
});

module.exports = Holiday;
