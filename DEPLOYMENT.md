# Deployment Guide - Backend Finger Attendance System

## 🚀 Production Deployment

This guide covers deploying the Backend-Finger attendance system to production.

---

## 📋 Pre-Deployment Checklist

- [ ] Server with Node.js 16+ installed
- [ ] MySQL 8.0+ database server
- [ ] Domain name configured (optional but recommended)
- [ ] SSL certificate obtained (Let's Encrypt recommended)
- [ ] Firewall configured
- [ ] Backup strategy in place

---

## 🔧 Server Requirements

### Minimum Requirements
- **CPU:** 2 cores
- **RAM:** 2GB
- **Storage:** 10GB
- **OS:** Ubuntu 20.04+ / CentOS 8+ / Debian 11+

### Recommended for Production
- **CPU:** 4 cores
- **RAM:** 4GB
- **Storage:** 20GB SSD
- **OS:** Ubuntu 22.04 LTS

---

## 📦 Installation Steps

### 1. Install Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Install MySQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# Secure installation
sudo mysql_secure_installation

# Verify MySQL is running
sudo systemctl status mysql
```

### 3. Clone Repository

```bash
# Clone from repository
git clone https://github.com/yourusername/backend-finger.git
cd backend-finger

# Or upload files via SCP/SFTP
scp -r ./backend-finger user@server:/var/www/
```

### 4. Install Dependencies

```bash
npm install --production
```

---

## ⚙️ Environment Configuration

### Create Production .env

```bash
cp .env.example .env
nano .env
```

### Required Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finger_attendance
DB_USERNAME=fingeruser
DB_PASSWORD=StrongPasswordHere123!

# JWT Secrets (MUST be changed!)
JWT_ACCESS_SECRET=generate-strong-secret-min-32-chars-12345678
JWT_REFRESH_SECRET=another-strong-secret-min-32-chars-12345678
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# Security
API_KEY_SECRET=your-api-key-secret-here-16-chars
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# Logging
LOG_LEVEL=info
```

### Generate Strong Secrets

```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗄️ Database Setup

### 1. Create Database and User

```sql
-- Login to MySQL
mysql -u root -p

-- Create database
CREATE DATABASE finger_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (replace with strong password)
CREATE USER 'fingeruser'@'localhost' IDENTIFIED BY 'StrongPasswordHere123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON finger_attendance.* TO 'fingeruser'@'localhost';
FLUSH PRIVILEGES;

EXIT;
```

### 2. Run Migration

```bash
# Run database migration
mysql -u fingeruser -p finger_attendance < scripts/migration_001_attendance_system.sql

# Verify tables created
mysql -u fingeruser -p finger_attendance -e "SHOW TABLES;"
```

---

## 🚀 Startup Options

### Option 1: PM2 (Recommended)

**Install PM2:**
```bash
sudo npm install -g pm2
```

**Start Application:**
```bash
pm2 start src/server.js --name "attendance-api"
pm2 save
pm2 startup
```

**PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs attendance-api # View logs
pm2 restart attendance-api
pm2 stop attendance-api
pm2 delete attendance-api
```

**PM2 Monitoring:**
```bash
pm2 monitor
```

### Option 2: systemd Service

**Create service file:**
```bash
sudo nano /etc/systemd/system/attendance-api.service
```

**Service configuration:**
```ini
[Unit]
Description=Attendance API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/backend-finger
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable attendance-api
sudo systemctl start attendance-api
sudo systemctl status attendance-api
```

### Option 3: Docker (Advanced)

**Dockerfile** (create in project root):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mysql
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: finger_attendance
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql_data:
```

**Run with Docker:**
```bash
docker-compose up -d
```

---

## 🔒 Reverse Proxy (Nginx)

### Install Nginx

```bash
sudo apt install nginx
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/attendance-api
```

**Configuration:**
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
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/attendance-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

---

## 📊 Monitoring & Logging

### PM2 Monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Application Logs

Logs are stored via Winston:
- Location: `logs/` directory (if configured)
- Format: JSON for easy parsing
- Levels: error, warn, info, debug

### Health Checks

```bash
# Liveness check
curl http://localhost:3000/health

# Readiness check (DB connectivity)
curl http://localhost:3000/ready
```

### Monitoring Tools (Optional)

- **Prometheus + Grafana** - Metrics visualization
- **PM2 Plus** - Advanced monitoring
- **New Relic / DataDog** - APM solutions
- **Uptime Robot** - Uptime monitoring

---

## 🔥 Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Application port (if direct access needed)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## 🔄 Updates & Maintenance

### Update Application

```bash
cd /var/www/backend-finger
git pull origin main
npm install --production
pm2 restart attendance-api
```

### Database Backup

```bash
# Create backup
mysqldump -u fingeruser -p finger_attendance > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
mysql -u fingeruser -p finger_attendance < backup_20260114_120000.sql
```

### Automated Backups (Cron)

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

---

## 🐛 Troubleshooting

### Check Application Status

```bash
pm2 status
pm2 logs attendance-api --lines 100
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -u fingeruser -p -h localhost finger_attendance

# Check MySQL is running
sudo systemctl status mysql
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/backend-finger

# Fix permissions
chmod 755 /var/www/backend-finger
```

---

## ✅ Post-Deployment Verification

1. **API Health Check:**
   ```bash
   curl https://api.yourdomain.com/health
   ```

2. **Swagger Documentation:**
   - Visit: `https://api.yourdomain.com/api/docs`

3. **Test Authentication:**
   ```bash
   curl -X POST https://api.yourdomain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"yourpassword"}'
   ```

4. **Monitor Logs:**
   ```bash
   pm2 logs attendance-api
   ```

---

## 📞 Support

For issues or questions:
- Check logs: `pm2 logs attendance-api`
- Review documentation: `/api/docs`
- Contact: admin@kampus.edu

---

**Last Updated:** January 14, 2026  
**Version:** 2.0.0
