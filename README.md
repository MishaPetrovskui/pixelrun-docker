# PixelRun — Docker Deployment

<div align="center">

![PixelRun](https://img.shields.io/badge/PixelRun-Game-brightgreen?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)
![ASP.NET](https://img.shields.io/badge/ASP.NET-Core-512BD4?style=for-the-badge&logo=dotnet)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Nginx](https://img.shields.io/badge/Nginx-Proxy-009639?style=for-the-badge&logo=nginx)

</div>

---

### Про проєкт

**PixelRun** — це браузерна 2D-гра-платформер з мультиплеєром, таблицями рекордів, магазином скінів та системою квестів.

#### Що було раніше

Раніше проєкт складався з **двох повністю окремих частин**, які запускалися незалежно одна від одної:

- **Сервер** (`Pixelrun_Server`) — ASP.NET Core API, запускався вручну через Visual Studio або `dotnet run`. Потребував окремо встановленого .NET SDK, SQLite, ручного налаштування JWT-ключів та портів.
- **Сайт** (`pixelrun-site/pixelrun-react`) — React-додаток, запускався через `npm start`. Потребував окремо встановленого Node.js і вручну прописаного URL бекенду.

Щоб запустити проєкт, розробник мав відкрити **два окремих термінали**, запустити обидва сервіси і слідкувати щоб порти не конфліктували.

#### Що зроблено

Весь проєкт **контейнеризовано за допомогою Docker Compose**:

- Один порт (`7034`) для всього — і сайт, і API, і Swagger
- Nginx виступає reverse proxy — роутить `/api/*`, `/ws/*`, `/swagger/*` на бекенд, все інше — на React SPA
- SQLite база зберігається у Docker volume — дані не втрачаються між перезапусками
- JWT-ключі та AdminKey задаються через змінні оточення
- PostgreSQL-сервіс підготовлений для майбутніх міграцій
- Мультиплеєр через WebSocket повністю проксується

### Архітектура

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

### Структура проєкту

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

### Швидкий старт

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
| **Сайт PixelRun** | http://localhost:7034 |
| **Swagger API** | http://localhost:7034/swagger/ |
| **API напряму** | http://localhost:7034/api/stats |

### Змінні оточення

| Змінна | Значення за замовчуванням | Опис |
|--------|--------------------------|------|
| `Jwt__Key` | `PIXELRUN_SUPER_SECRET_KEY_MIN32CHARS_HERE!` | Секрет JWT (**змінити у продакшені!**) |
| `AdminKey` | `CHANGE_ME_ADMIN_SECRET_KEY` | Ключ адмін-ендпоінтів |
| `ConnectionStrings__DefaultConnection` | `Data Source=/app/data/pixelrun.db` | Шлях до SQLite |

### Корисні команди

```bash
# Запустити всі сервіси
docker compose up

# Зупинити
docker compose down
```
