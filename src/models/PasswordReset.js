// src/models/PasswordReset.js - Model untuk password reset tokens
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PasswordReset = sequelize.define('PasswordReset', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        admin_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'admins',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        code: {
            type: DataTypes.STRING(6),
            allowNull: false,
            comment: '6-digit verification code'
        },
        reset_token: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Temporary token generated after code verification'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'Code expiration time (15 minutes from creation)'
        },
        used_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Timestamp when code/token was used'
        }
    }, {
        sequelize,
        tableName: 'password_resets',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false, // No need for updatedAt
        indexes: [
            {
                name: 'idx_email',
                fields: ['email']
            },
            {
                name: 'idx_code',
                fields: ['code']
            },
            {
                name: 'idx_reset_token',
                fields: ['reset_token']
            },
            {
                name: 'idx_expires_at',
                fields: ['expires_at']
            }
        ]
    });

    /**
     * Model associations
     */
    PasswordReset.associate = (models) => {
        PasswordReset.belongsTo(models.Admin, {
            foreignKey: 'admin_id',
            as: 'admin'
        });
    };

    /**
     * Generate 6-digit verification code
     */
    PasswordReset.generateCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    /**
     * Generate reset token (random string)
     */
    PasswordReset.generateResetToken = () => {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
    };

    /**
     * Check if code is expired
     */
    PasswordReset.prototype.isExpired = function () {
        return new Date() > this.expires_at;
    };

    /**
     * Check if code/token has been used
     */
    PasswordReset.prototype.isUsed = function () {
        return this.used_at !== null;
    };

    /**
     * Mark as used
     */
    PasswordReset.prototype.markAsUsed = async function () {
        this.used_at = new Date();
        await this.save();
    };

    return PasswordReset;
};
