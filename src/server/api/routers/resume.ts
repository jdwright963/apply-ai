import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'

export const resumeRouter = createTRPCRouter({
  upload: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      text: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { resumeText: input.text }
      })

      return {
        success: true,
        message: 'Resume uploaded successfully',
        fileName: input.fileName,
        textLength: input.text.length
      }
    }),

  get: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { resumeText: true }
      })

      return {
        hasResume: !!user?.resumeText,
        textLength: user?.resumeText?.length || 0,
      }
    }),
})
