# 🎮 PixelRun — Docker Deployment

<div align="center">

![PixelRun](https://img.shields.io/badge/PixelRun-Game-brightgreen?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)
![ASP.NET](https://img.shields.io/badge/ASP.NET-Core-512BD4?style=for-the-badge&logo=dotnet)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Nginx](https://img.shields.io/badge/Nginx-Proxy-009639?style=for-the-badge&logo=nginx)

</div>

---

## 🇺🇦 Українська

### 📖 Про проєкт

**PixelRun** — це браузерна 2D-гра-платформер з мультиплеєром, таблицями рекордів, магазином скінів та системою квестів.

#### Що було раніше

Раніше проєкт складався з **двох повністю окремих частин**, які запускалися незалежно одна від одної:

- 🖥️ **Сервер** (`Pixelrun_Server`) — ASP.NET Core API, запускався вручну через Visual Studio або `dotnet run`. Потребував окремо встановленого .NET SDK, SQLite, ручного налаштування JWT-ключів та портів.
- 🌐 **Сайт** (`pixelrun-site/pixelrun-react`) — React-додаток, запускався через `npm start`. Потребував окремо встановленого Node.js і вручну прописаного URL бекенду.

Щоб запустити проєкт, розробник мав відкрити **два окремих термінали**, запустити обидва сервіси і слідкувати щоб порти не конфліктували.

#### Що зроблено

Весь проєкт **контейнеризовано за допомогою Docker Compose**:

- ✅ Один порт (`7034`) для всього — і сайт, і API, і Swagger
- ✅ Nginx виступає reverse proxy — роутить `/api/*`, `/ws/*`, `/swagger/*` на бекенд, все інше — на React SPA
- ✅ SQLite база зберігається у Docker volume — дані не втрачаються між перезапусками
- ✅ JWT-ключі та AdminKey задаються через змінні оточення
- ✅ PostgreSQL-сервіс підготовлений для майбутніх міграцій
- ✅ Мультиплеєр через WebSocket повністю проксується

### 🏗️ Архітектура

```
Браузер
  │
  ▼
┌─────────────────────────────┐
│  frontend : 7034            │  ← Nginx (React SPA)
│  /api/*   →  proxy :8080    │
│  /ws/*    →  proxy :8080    │
│  /swagger/→  proxy :8080    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  api : 8080                 │  ← ASP.NET Core
│  REST API + WebSocket       │
│  SQLite (volume)            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  db : 5432                  │  ← PostgreSQL 16
│  (підготовлено для міграцій)│
└─────────────────────────────┘
```

### 📁 Структура проєкту

```
pixelrun/
├── Dockerfile              ← образ ASP.NET Core бекенду
├── Dockerfile.frontend     ← образ React фронтенду (multi-stage)
├── nginx.conf              ← конфіг Nginx (проксі API + WebSocket)
├── docker-compose.yaml     ← оркестрація всіх трьох сервісів
├── Pixelrun_Server/        ← C# проєкт (ASP.NET Core API)
│   └── Pixelrun_Server/
│       ├── Controllers/    ← REST endpoints
│       ├── Models/         ← моделі БД та DTO
│       ├── Services/       ← бізнес-логіка
│       ├── Program.cs      ← точка входу
│       ├── GameDbContext.cs← EF Core контекст
│       └── appsettings.json
└── pixelrun-site/
    └── pixelrun-react/     ← React SPA
        ├── src/
        │   └── App.js      ← головний компонент
        └── public/
```

### 🚀 Швидкий старт

#### 1. Клонувати репозиторій

```bash
git clone https://github.com/MishaPetrovskui/pixelrun-docker.git
cd pixelrun-docker
```

#### 2. Зібрати та запустити

```bash
docker compose up --build
```

Перша збірка займає ~3–5 хвилин (завантаження SDK, npm install).

#### 3. Відкрити у браузері

| Сервіс | URL |
|--------|-----|
| 🎮 **Сайт PixelRun** | http://localhost:7034 |
| 📋 **Swagger API** | http://localhost:7034/swagger/ |
| 🔌 **API напряму** | http://localhost:7034/api/stats |

### ⚙️ Змінні оточення

| Змінна | Значення за замовчуванням | Опис |
|--------|--------------------------|------|
| `Jwt__Key` | `PIXELRUN_SUPER_SECRET_KEY_MIN32CHARS_HERE!` | Секрет JWT (**змінити у продакшені!**) |
| `AdminKey` | `CHANGE_ME_ADMIN_SECRET_KEY` | Ключ адмін-ендпоінтів |
| `ConnectionStrings__DefaultConnection` | `Data Source=/app/data/pixelrun.db` | Шлях до SQLite |

### 🛠️ Корисні команди

```bash
# Запустити всі сервіси
docker compose up

# Зупинити
docker compose down

# Зупинити і видалити дані БД
docker compose down -v

# Переглянути логи бекенду
docker compose logs -f api

# Переглянути логи Nginx
docker compose logs -f frontend

# Перебудувати після змін у коді
docker compose up --build
```

---

## 🇬🇧 English

### 📖 About

**PixelRun** is a browser-based 2D platformer with multiplayer, leaderboards, a skin shop, and a quest system.

#### What it was before

The project previously consisted of **two completely separate parts**, each launched independently:

- 🖥️ **Server** (`Pixelrun_Server`) — ASP.NET Core API, launched manually via Visual Studio or `dotnet run`. Required a separately installed .NET SDK, SQLite, and manual configuration of JWT keys and ports.
- 🌐 **Website** (`pixelrun-site/pixelrun-react`) — React app, launched via `npm start`. Required a separately installed Node.js and a hardcoded backend URL.

To run the project, a developer had to open **two separate terminals**, start both services, and ensure no port conflicts.

#### What was done

The entire project was **containerized with Docker Compose**:

- ✅ Single port (`7034`) for everything — website, API, and Swagger
- ✅ Nginx acts as a reverse proxy — routes `/api/*`, `/ws/*`, `/swagger/*` to the backend, everything else to the React SPA
- ✅ SQLite database stored in a Docker volume — data persists across restarts
- ✅ JWT keys and AdminKey set via environment variables
- ✅ PostgreSQL service prepared for future migrations
- ✅ Multiplayer WebSocket fully proxied

### 🏗️ Architecture

```
Browser
  │
  ▼
┌─────────────────────────────┐
│  frontend : 7034            │  ← Nginx (React SPA)
│  /api/*   →  proxy :8080    │
│  /ws/*    →  proxy :8080    │
│  /swagger/→  proxy :8080    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  api : 8080                 │  ← ASP.NET Core
│  REST API + WebSocket       │
│  SQLite (volume)            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  db : 5432                  │  ← PostgreSQL 16
│  (prepared for migrations)  │
└─────────────────────────────┘
```

### 📁 Project Structure

```
pixelrun/
├── Dockerfile              ← ASP.NET Core backend image
├── Dockerfile.frontend     ← React frontend image (multi-stage)
├── nginx.conf              ← Nginx config (API + WebSocket proxy)
├── docker-compose.yaml     ← orchestration of all three services
├── Pixelrun_Server/        ← C# project (ASP.NET Core API)
│   └── Pixelrun_Server/
│       ├── Controllers/    ← REST endpoints
│       ├── Models/         ← DB models and DTOs
│       ├── Services/       ← business logic
│       ├── Program.cs      ← entry point
│       ├── GameDbContext.cs← EF Core context
│       └── appsettings.json
└── pixelrun-site/
    └── pixelrun-react/     ← React SPA
        ├── src/
        │   └── App.js      ← main component
        └── public/
```

### 🚀 Quick Start

#### 1. Clone the repository

```bash
git clone https://github.com/MishaPetrovskui/pixelrun-docker.git
cd pixelrun-docker
```

#### 2. Build and run

```bash
docker compose up --build
```

First build takes ~3–5 minutes (downloading SDK, npm install).

#### 3. Open in browser

| Service | URL |
|---------|-----|
| 🎮 **PixelRun Website** | http://localhost:7034 |
| 📋 **Swagger API** | http://localhost:7034/swagger/ |
| 🔌 **API direct** | http://localhost:7034/api/stats |

### ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `Jwt__Key` | `PIXELRUN_SUPER_SECRET_KEY_MIN32CHARS_HERE!` | JWT secret (**change in production!**) |
| `AdminKey` | `CHANGE_ME_ADMIN_SECRET_KEY` | Admin endpoint key |
| `ConnectionStrings__DefaultConnection` | `Data Source=/app/data/pixelrun.db` | SQLite path |

### 🛠️ Useful Commands

```bash
# Start all services
docker compose up

# Stop
docker compose down

# Stop and remove database data
docker compose down -v

# View backend logs
docker compose logs -f api

# View Nginx logs
docker compose logs -f frontend

# Rebuild after code changes
docker compose up --build
```

---

<div align="center">

Made with ❤️ by MishaPetrovskui

</div>
