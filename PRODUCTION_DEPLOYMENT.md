# Production Deployment Guide - Debian Server

## 📋 OVERVIEW

Deployment stack:
- **OS**: Debian 11/12
- **Device**: Revo W-202BNC (FingerBaja) - IP: 172.17.2.250
- **Backend**: Node.js + Express + Prisma
- **Database**: MySQL 8.0
- **Frontend**: React (Vite build)
- **Web Server**: Nginx
- **Process Manager**: PM2

---

## 🚀 DEPLOYMENT STEPS

### PHASE 1: Server Setup

#### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### 1.2 Install Dependencies
```bash
# Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL Server
sudo apt install -y mysql-server

# Nginx
sudo apt install -y nginx

# PM2 (Process Manager)
sudo npm install -g pm2

# Build tools
sudo apt install -y build-essential git
```

---

### PHASE 2: Database Setup

#### 2.1 Secure MySQL
```bash
sudo mysql_secure_installation
```

#### 2.2 Create Database & User
```bash
sudo mysql -u root -p

# Di MySQL prompt:
CREATE DATABASE finger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finger_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON finger_db.* TO 'finger_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 2.3 Import Schema
```bash
# Copy schema dari development
scp -r Backend-Finger/prisma user@server-ip:/opt/finger-system/backend/

# Di server:
cd /opt/finger-system/backend
npx prisma db push
```

---

### PHASE 3: Backend Deployment

#### 3.1 Clone/Upload Backend
```bash
# Create directory
sudo mkdir -p /opt/finger-system/backend
sudo chown $USER:$USER /opt/finger-system/backend

# Upload files (dari laptop Windows)
scp -r Backend-Finger/* user@server-ip:/opt/finger-system/backend/
```

#### 3.2 Configure Environment
```bash
cd /opt/finger-system/backend

# Create production .env
nano .env
```

**Production `.env`:**
```env
NODE_ENV=production
PORT=3333

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finger_db
DB_USERNAME=finger_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# CORS (adjust to your domain)
CORS_ORIGINS=https://yourdomain.com,http://server-ip

# Fingerprint Device
FINGERPRINT_IP=172.17.2.250
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=5000
FINGERPRINT_DEVICE_ID=FingerBaja

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/finger-system/backend.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### 3.3 Install Dependencies & Build
```bash
npm install --production
npx prisma generate
```

#### 3.4 Start with PM2
```bash
# Start backend
pm2 start src/server.js --name finger-backend

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
# Follow the command output instructions

# Check status
pm2 status
pm2 logs finger-backend
```

---

### PHASE 4: Frontend Deployment

#### 4.1 Build Frontend (di laptop development)
```bash
cd Frontend-Finger

# Update API base URL for production
# Edit: src/config/api.js
# API_BASE_URL = 'https://yourdomain.com' atau 'http://server-ip:3333'

# Build
npm run build
# Output: dist/ folder
```

#### 4.2 Upload Build ke Server
```bash
# Upload dist folder
scp -r dist/* user@server-ip:/opt/finger-system/frontend/
```

---

### PHASE 5: Nginx Configuration

#### 5.1 Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/finger-system
```

**Nginx Config:**
```nginx
# Frontend + Backend Proxy
server {
    listen 80;
    server_name yourdomain.com;  # atau IP server

    # Frontend (React static files)
    location / {
        root /opt/finger-system/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://localhost:3333/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # ADMS Push Endpoint
    location /adms/ {
        proxy_pass http://localhost:3333/adms/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/finger-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### PHASE 6: Device Integration (2 Options)

#### **Option A: Via ADMS Software (Laptop Windows)**

**Keep ADMS running di laptop, configure:**
```
Backend URL: http://server-ip:3333/adms/push
atau
Backend URL: https://yourdomain.com/adms/push
```

**Laptop harus:**
- ✅ Selalu nyala saat jam kerja
- ✅ Bisa access device (172.17.2.250)
- ✅ Bisa access server (via internet/LAN)

#### **Option B: Direct Integration (zklib) - RECOMMENDED**

**Setup cron job di server:**

```bash
# Create sync script
nano /opt/finger-system/backend/scripts/auto-sync-fingerprint.js
```

**Script content:**
```javascript
// auto-sync-fingerprint.js
const fingerprintService = require('../src/services/fingerprint.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncAttendance() {
  try {
    console.log('[SYNC] Starting fingerprint attendance sync...');
    
    // Get logs from device
    const logs = await fingerprintService.getAttendanceLogs();
    
    // Process each log...
    for (const log of logs) {
      // Save to database
      // (implement logic similar to adms.controller.js)
    }
    
    console.log(`[SYNC] Synced ${logs.length} records`);
  } catch (error) {
    console.error('[SYNC] Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncAttendance();
```

**Setup cron:**
```bash
# Add to crontab
crontab -e

# Sync every 5 minutes during work hours (7 AM - 6 PM)
*/5 7-18 * * 1-6 /usr/bin/node /opt/finger-system/backend/scripts/auto-sync-fingerprint.js >> /var/log/finger-system/sync.log 2>&1
```

---

### PHASE 7: SSL/HTTPS (Optional - Recommended)

#### Using Let's Encrypt (Free):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo systemctl restart nginx
```

**Nginx will auto-update to HTTPS!**

---

## 🔒 SECURITY CHECKLIST

```
[ ] Change default MySQL password
[ ] Use strong JWT_SECRET
[ ] Enable firewall (ufw)
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw enable
[ ] Disable root SSH login
[ ] Use SSH keys (not password)
[ ] Setup fail2ban
[ ] Enable HTTPS (SSL certificate)
[ ] Restrict ADMS endpoint by IP (if using Option A)
[ ] Regular backups (database + code)
```

---

## 📊 MONITORING

### PM2 Monitoring
```bash
pm2 monit
pm2 logs finger-backend --lines 100
```

### Log Files
```bash
# Backend logs
tail -f /var/log/finger-system/backend.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Sync logs (if using Option B)
tail -f /var/log/finger-system/sync.log
```

### Database Backup
```bash
# Daily backup cron
0 2 * * * /usr/bin/mysqldump -u finger_user -p'password' finger_db > /backup/finger_db_$(date +\%Y\%m\%d).sql
```

---

## 🔄 DEPLOYMENT WORKFLOW

### Development → Production:

1. **Test di local (Windows laptop)**
2. **Commit changes to Git**
3. **Pull di server:**
   ```bash
   cd /opt/finger-system/backend
   git pull origin main
   npm install
   npx prisma generate
   pm2 restart finger-backend
   ```
4. **Frontend build & deploy:**
   ```bash
   # Di laptop:
   npm run build
   
   # Upload:
   scp -r dist/* user@server:/opt/finger-system/frontend/
   ```

---

## 💰 COST ESTIMATION

**Total biaya production (asumsi VPS):**

| Item | Cost/Month | Notes |
|------|------------|-------|
| VPS Debian | $5-20 | Vultr, DigitalOcean, AWS Lightsail |
| Domain | $1-2 | .com/.id |
| SSL Certificate | $0 | Let's Encrypt (gratis) |
| **TOTAL** | **$6-22/month** | ✅ Jauh lebih murah dari Fingerspot.io! |

**vs Fingerspot.io Cloud:** $5-25/month/device + tidak full control

---

## ✅ KESIMPULAN

**REKOMENDASI:**
1. ✅ Gunakan **Mode 1 (Local Integration)** - GRATIS
2. ✅ Deploy ke **Debian VPS** untuk production
3. ✅ Gunakan **Direct Integration (zklib)** untuk automation penuh
4. ❌ **TIDAK perlu Fingerspot.io Cloud** - bayar bulanan & tidak full control

**Next Steps:**
1. Selesaikan development & testing di laptop
2. Siapkan Debian server (VPS)
3. Deploy menggunakan guide ini
4. Monitor & maintain

---

**Created:** 2026-02-08  
**Last Updated:** 12:04 WIB
