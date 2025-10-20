# Apply AI - T3 Stack with Magic Link Authentication

A Next.js application built with the T3 stack (Next.js + tRPC + Prisma + Tailwind + NextAuth) featuring magic link email authentication.

## Features

- ✅ Next.js 15 with App Router
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ tRPC for type-safe APIs
- ✅ Prisma with PostgreSQL
- ✅ NextAuth.js with magic link authentication
- ✅ Resend for email delivery
- ✅ No passwords, no OAuth - just magic links!

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: tRPC
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with EmailProvider
- **Email Service**: Resend

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Resend account for email delivery

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database
2. Copy `env.example` to `.env.local`
3. Update the `DATABASE_URL` in `.env.local` with your PostgreSQL connection string

```bash
cp env.example .env.local
```

### 3. Environment Variables

Update `.env.local` with your actual values:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/apply_ai?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Resend (for email delivery)
RESEND_API_KEY="your-resend-api-key-here"

# Email Configuration (for Resend)
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_SERVER_HOST="smtp.resend.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="resend"
EMAIL_SERVER_PASSWORD="your-resend-api-key-here"
```

### 4. Resend Setup

1. Sign up at [Resend](https://resend.com)
2. Get your API key from the dashboard
3. Add your domain and verify it
4. Update the `RESEND_API_KEY` and `EMAIL_FROM` in your `.env.local`

### 5. Database Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── auth/
│   │   └── signin/         # Login page
│   ├── dashboard/          # Protected dashboard
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Home page (redirects)
├── components/
│   └── providers.tsx      # tRPC and NextAuth providers
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   └── db.ts              # Prisma client
├── pages/
│   └── api/               # API routes
│       ├── auth/          # NextAuth API routes
│       └── trpc/          # tRPC API routes
├── server/
│   └── api/               # tRPC server setup
│       ├── root.ts        # Main router
│       └── trpc.ts        # tRPC configuration
└── utils/
    └── api.ts             # tRPC client
```

## Authentication Flow

1. User visits the app and is redirected to `/auth/signin`
2. User enters their email address
3. A magic link is sent to their email via Resend
4. User clicks the link and is automatically signed in
5. User is redirected to `/dashboard`
6. Session is managed by NextAuth with database sessions

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma Studio
- `npx prisma migrate dev` - Run database migrations
- `npx prisma generate` - Generate Prisma client

## Deployment

1. Set up a PostgreSQL database (e.g., Supabase, Railway, or Neon)
2. Configure environment variables in your deployment platform
3. Run database migrations
4. Deploy to Vercel, Netlify, or your preferred platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT