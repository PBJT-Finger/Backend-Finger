// src/models/HolidayCache.js - Model untuk cache hari libur yang sudah dihitung
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HolidayCache = sequelize.define('HolidayCache', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tanggal: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
        comment: 'Tanggal libur yang sudah dihitung'
    },
    nama_libur: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nama hari libur'
    },
    tipe: {
        type: DataTypes.ENUM('NASIONAL', 'CUTI_BERSAMA', 'HARI_RAYA', 'KAMPUS'),
        allowNull: false,
        comment: 'Tipe hari libur'
    },
    tahun: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Tahun libur'
    }
}, {
    tableName: 'holiday_cache',
    paranoid: false,  // Disabled - holiday cache is regenerated annually
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['tahun'] },
        { fields: ['tanggal'], unique: true },
        { fields: ['jenis_hari'] }
    ]
});

module.exports = HolidayCache;
