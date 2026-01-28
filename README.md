# Backend Finger Presence - Production Ready ✅

Backend Application for Fingerprint Attendance System with **Clean Architecture**.

## 🚀 Quick Start (Production)

1. **Start Server:**
   ```bash
   start.bat
   ```
2. **Run Validation Tests:**
   ```bash
   test.bat
   ```
3. **Test Clean Architecture:**
   ```bash
   test-clean.bat
   ```

## 🏗️ Clean Architecture

This project now implements **Clean Architecture** principles for better maintainability and testability.

### Architecture Layers
- **Domain Layer**: Pure business entities, value objects, repository interfaces (no dependencies)
- **Application Layer**: Use cases orchestrating business workflows
- **Infrastructure Layer**: Prisma repositories, database, DI container
- **Presentation Layer**: Thin controllers handling HTTP only

📖 **Read**: [`CLEAN_ARCHITECTURE.md`](./CLEAN_ARCHITECTURE.md) for detailed architecture guide

## 📂 Project Structure

- `src/domain/` - Business entities, value objects, repository interfaces
- `src/application/` - Use cases (business logic orchestration)
- `src/infrastructure/` - Prisma repositories, DI container, database
- `src/controllers/` - Thin HTTP adapters (clean architecture version available)
  - `attendance.controller.clean.js` - NEW clean architecture version
  - `attendance.controller.js` - Legacy version (still works)
- `src/models/` - Centralized Prisma exports (Sequelize removed from root)
- `src/models/legacy/` - Archived Sequelize models (Reference only)
- `scripts/` - Maintenance & Setup scripts
  - `db/` - Database reimport & shifts tools
  - `setup/` - Installation scripts
  - `legacy/` - Old tools

## 🔧 Maintenance

- **Reimport Database:** `scripts/db/reimport-database.bat`
- **Fix Shift Logic:** `scripts/db/reimport-shifts.bat`

## 🛠 Tech Stack

- **Runtime:** Node.js
- **ORM:** Prisma (v6.x)
- **DB:** MySQL
- **Auth:** JWT (Deferred migration)
