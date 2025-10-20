import { createTRPCRouter } from '@/server/api/trpc'
import { resumeRouter } from '@/server/api/routers/resume'
import { applicationRouter } from '@/server/api/routers/application'

export const appRouter = createTRPCRouter({
  resume: resumeRouter,
  application: applicationRouter,
})

export type AppRouter = typeof appRouter
