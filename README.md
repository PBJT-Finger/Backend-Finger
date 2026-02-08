# Backend Finger - Attendance System

Production-ready backend API for fingerprint-based campus attendance tracking system.

---

## 📋 Table of Contents

- [Recent Updates](#-recent-updates)
- [Quick Start](#-quick-start)
- [Development](#-development)
- [Database Management](#️-database-management)
- [Production Deployment](#-production-deployment)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)

---

## 🆕 Recent Updates

### February 2, 2026

#### 🐛 Critical Bug Fix: Attendance Percentage Calculation
**Issue**: Attendance percentage was always showing 100% regardless of actual attendance.

**Root Cause**: Transformer functions calculated percentage as `(records_present / records_present)` instead of `(records_present / total_working_days)`.

**Fix Applied**:
- Added `calculateWorkingDays()` helper function in `attendanceTransformer.js`
- Updated `transformDosenAttendance()` and `transformKaryawanAttendance()` to accept `startDate` and `endDate` parameters
- Now correctly calculates: `percentage = (days_present / total_working_days_in_range) * 100`

**Impact**: ✅ Dashboard now shows realistic attendance percentages (e.g., 75%, 80%, etc.)

**Files Modified**:
- `src/utils/attendanceTransformer.js`
- `src/controllers/attendance.controller.js`

#### 📁 Backend Structure Cleanup
**Changes**:
- Created `seeds/` directory for SQL sample data files
- Moved all SQL files from root to `seeds/`:
  - `dummy.sql` → `seeds/dummy.sql`
  - `insert_today_data.sql` → `seeds/insert_today_data.sql`
  - `5_insert_data.sql` → `seeds/5_insert_data.sql`
  - `1_month_attendance.sql` → `seeds/1_month_attendance.sql`
- Updated `package.json` scripts to reference new paths

**Impact**: ✅ Cleaner root directory, better project organization

#### 🔧 Code Quality Improvements
**Applied**:
- ESLint: Fixed auto-fixable issues (20 warnings remaining - unused variables)
- Prettier: Formatted all JavaScript files for consistency

**Impact**: ✅ Consistent code style, better maintainability

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- MySQL 8.0+ running
- Git (for cloning repository)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/yourusername/backend-finger.git
cd backend-finger

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Setup database
npm run db:setup

# 5. Start development server
npm run dev
```

Server akan berjalan di `http://localhost:3333`

---

## 💻 Development

### NPM Scripts

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start

# Database management
npm run db:setup          # Initial database setup
npm run db:reset         # Reset to dummy data
npm run db:import-today  # Import today's sample data

# Code Quality
npm run lint            # Check code with ESLint
npm run lint:fix        # Fix ESLint issues automatically
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
```

### Environment Variables

Key variables in `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finger_db
DB_USERNAME=root
DB_PASSWORD=admin

# JWT
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3333
NODE_ENV=development
```

### API Documentation

- **Swagger UI**: `http://localhost:3333/api/docs`
- **Scalar UI**: `http://localhost:3333/api/scalar`

---

## 🗄️ Database Management

### Initial Setup

```bash
npm run db:setup
```

Creates database and imports sample data:
- 10 Dosen (lecturers)
- 10 Karyawan (staff)
- 1 week attendance records

### Reset Database

```bash
npm run db:reset
```

Clears all data and reimports sample data.

### Import Today's Data

```bash
npm run db:import-today
```

Adds attendance records for current date (useful for testing "Hari Ini" filter).

### Manual Database Access

```bash
mysql -u root -padmin finger_db
```

---

## 🚀 Production Deployment

### Server Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 2GB
- Storage: 10GB
- OS: Ubuntu 20.04+ / CentOS 8+

**Recommended:**
- CPU: 4 cores
- RAM: 4GB
- Storage: 20GB SSD
- OS: Ubuntu 22.04 LTS

### Deployment Steps

#### 1. Install Dependencies

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL
sudo apt install mysql-server
sudo mysql_secure_installation

# For production monitoring (optional)
sudo apt install htop
```

#### 2. Clone & Install

```bash
cd /var/www
git clone https://github.com/yourusername/backend-finger.git
cd backend-finger
npm install --production
```

#### 3. Configure Production Environment

```bash
cp .env.example .env
nano .env
```

**Production .env:**
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finger_attendance
DB_USERNAME=fingeruser
DB_PASSWORD=<strong-password-here>

# JWT (CHANGE THESE!)
JWT_ACCESS_SECRET=<generate-32-char-secret>
JWT_REFRESH_SECRET=<generate-32-char-secret>

# Server
PORT=3000
NODE_ENV=production

# CORS (your frontend domain)
CORS_ORIGINS=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

**Generate secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 4. Setup Production Database

```sql
-- Login MySQL
mysql -u root -p

-- Create database
CREATE DATABASE finger_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'fingeruser'@'localhost' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON finger_attendance.* TO 'fingeruser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Import schema
mysql -u fingeruser -p finger_attendance < dummy.sql
```

#### 5. Setup Systemd Service

Create systemd service file:

```bash
sudo nano /etc/systemd/system/attendance-api.service
```

**Service configuration:**
```ini
[Unit]
Description=Attendance API Backend
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/backend-finger
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /var/www/backend-finger/src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=attendance-api

[Install]
WantedBy=multi-user.target
```

**Start service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable attendance-api
sudo systemctl start attendance-api

# Check status
sudo systemctl status attendance-api
```

#### 6. Setup Nginx Reverse Proxy

```bash
sudo apt install nginx
```

**Nginx config** (`/etc/nginx/sites-available/attendance-api`):
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/attendance-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Firewall Setup

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Monitoring

```bash
# View application logs
sudo journalctl -u attendance-api -f

# View last 100 lines
sudo journalctl -u attendance-api -n 100

# Monitor system resources
htop
```

**Log rotation** (automatic with systemd journal):
```bash
# Configure journal size limits
sudo nano /etc/systemd/journald.conf
# Set: SystemMaxUse=1G
sudo systemctl restart systemd-journald
```

### Backups

**Manual backup:**
```bash
mysqldump -u fingeruser -p finger_attendance > backup_$(date +%Y%m%d).sql
```

**Automated backup (cron):**
```bash
crontab -e
```

Add:
```cron
# Daily backup at 2 AM
0 2 * * * mysqldump -u fingeruser -p'password' finger_attendance > /backups/db_$(date +\%Y\%m\%d).sql

# Keep only last 7 days
0 3 * * * find /backups -name "db_*.sql" -mtime +7 -delete
```

### Updates

```bash
cd /var/www/backend-finger
git pull origin main
npm install --production
sudo systemctl restart attendance-api
```

---

## 🛠 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **ORM:** Prisma 6.x
- **Database:** MySQL 8.0+
- **Authentication:** JWT
- **Process Manager:** Systemd
- **Documentation:** Swagger + Scalar
- **Logging:** Winston

---

## 📂 Project Structure

```
backend-finger/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Server entry point
│   ├── controllers/        # Request handlers
│   │   ├── attendance.controller.js
│   │   ├── auth.controller.js
│   │   └── export.controller.js
│   ├── routes/             # API routes
│   ├── middlewares/        # Auth, validation, error handling
│   ├── utils/              # Utilities (logger, transformers)
│   ├── lib/                # Database connection
│   ├── config/             # Configuration
│   ├── services/           # Business logic
│   └── validators/         # Input validation
├── prisma/
│   └── schema.prisma       # Database schema
├── dummy.sql               # Sample data
├── insert_today_data.sql   # Today's sample data
├── .env                    # Environment variables
├── package.json            # Dependencies & scripts
└── README.md               # This file
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Linux
sudo lsof -i :5000
sudo kill -9 <pid>
```

**Database connection failed:**
```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u root -p finger_db
```

**Backend won't start:**
```bash
# Check service status
sudo systemctl status attendance-api

# View logs
sudo journalctl -u attendance-api -n 50

# Restart service
sudo systemctl restart attendance-api
```

### Health Checks

```bash
# API health
curl http://localhost:5000/health

# Database connectivity
curl http://localhost:5000/ready
```

### Contact

For issues or questions:
- API Documentation: `http://localhost:5000/api/docs`
- Email: admin@kampus.edu

---

**Last Updated:** January 29, 2026  
**Version:** 2.1.0
