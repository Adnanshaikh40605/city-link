# City Link Phase 2 — local API

Uses your **local PostgreSQL** database named `city link` (no Railway).

## Setup

1. Copy env file and set your Postgres password:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/city%20link?schema=public"
```

Note: the space in `city link` is encoded as `%20`.

2. Install + migrate + seed:

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

API: `http://127.0.0.1:4000`

## Test accounts (after seed)

- User: `demo@citylink.app` / `password`
- Admin: `admin@citylink.app` / `admin123`

## Flutter

```bash
cd ../city_link
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:4000
```
