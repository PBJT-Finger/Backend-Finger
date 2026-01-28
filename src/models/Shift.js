// src/models/Shift.js - Model untuk master data shift kerja
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Shift = sequelize.define('Shift', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nama_shift: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Nama shift (e.g., Shift Pagi, Shift Sore)'
    },
    jam_masuk: {
        type: DataTypes.TIME,
        allowNull: false,
        comment: 'Jam mulai shift'
    },
    jam_keluar: {
        type: DataTypes.TIME,
        allowNull: false,
        comment: 'Jam selesai shift'
    },
    deskripsi: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Deskripsi shift'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Status aktif shift'
    }
}, {
    tableName: 'shifts',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['is_active'] }
    ]
});

// Associations will be defined in models/index.js
module.exports = Shift;
