# Backend Finger - Attendance System

Production-ready backend API for fingerprint-based campus attendance tracking system.

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Development](#-development)
- [Database Management](#️-database-management)
- [Production Deployment](#-production-deployment)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)

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

Server akan berjalan di `http://localhost:5000`

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

# PM2 (Production daemon)
npm run pm2:start        # Start with PM2
npm run pm2:stop         # Stop PM2
npm run pm2:restart      # Restart PM2
npm run pm2:delete       # Remove PM2 process
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
PORT=5000
NODE_ENV=development
```

### API Documentation

- **Swagger UI**: `http://localhost:5000/api/docs`
- **Scalar UI**: `http://localhost:5000/api/scalar`

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

# PM2 (Process Manager)
sudo npm install -g pm2
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

#### 5. Start with PM2

```bash
# Start application
pm2 start src/server.js --name "attendance-api"

# Save PM2 list
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

**PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs attendance-api # View logs
pm2 restart attendance-api
pm2 stop attendance-api
pm2 monit               # Monitor resources
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
# View logs
pm2 logs attendance-api

# Monitor resources
pm2 monit

# Setup log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
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
pm2 restart attendance-api
```

---

## 🛠 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **ORM:** Prisma 6.x
- **Database:** MySQL 8.0+
- **Authentication:** JWT
- **Process Manager:** PM2
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
# Check logs
pm2 logs attendance-api

# Check process status
pm2 status
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
