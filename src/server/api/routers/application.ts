import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { scrapeJobPosting } from '@/lib/job-scraper'
import { generateCoverLetter } from '@/lib/openai-service'

export const applicationRouter = createTRPCRouter({
  analyzeJobPosting: protectedProcedure
    .input(z.object({
      url: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Scrape the job posting
        const scrapingResult = await scrapeJobPosting(input.url)
        
        if (!scrapingResult.success || !scrapingResult.data) {
          throw new Error(scrapingResult.error || 'Failed to scrape job posting')
        }
        
        const jobData = scrapingResult.data
        
        // Create application record with scraped data
        const application = await ctx.db.application.create({
          data: {
            userId: ctx.session.user.id,
            url: input.url,
            company: jobData.company,
            title: jobData.title,
            description: jobData.description,
            location: jobData.location,
            salary: jobData.salary,
            requirements: jobData.requirements || [],
            responsibilities: jobData.responsibilities || [],
            status: 'Analyzed',
            scrapedAt: new Date(),
          },
        })
        
        return {
          success: true,
          application,
          jobData,
        }
      } catch (error) {
        console.error('Error analyzing job posting:', error)
        throw new Error(error instanceof Error ? error.message : 'Failed to analyze job posting')
      }
    }),

  generateCoverLetter: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get the application and user data
        const application = await ctx.db.application.findFirst({
          where: {
            id: input.applicationId,
            userId: ctx.session.user.id,
          },
          include: {
            user: {
              select: {
                resumeText: true,
                humanifyMode: true,
              },
            },
          },
        })

        if (!application) {
          throw new Error('Application not found')
        }

        if (!application.user.resumeText) {
          throw new Error('No resume found. Please upload a resume first.')
        }

        if (!application.description) {
          throw new Error('No job description found. Please analyze the job posting first.')
        }

        // Generate the cover letter using OpenAI
        const result = await generateCoverLetter(
          application.user.resumeText,
          application.description,
          application.title || 'Unknown Title',
          application.company || 'Unknown Company',
          application.user.humanifyMode
        )

        // Update the application with the generated cover letter and fit score
        const updatedApplication = await ctx.db.application.update({
          where: {
            id: input.applicationId,
          },
          data: {
            coverLetter: result.coverLetter,
            fitScore: result.fitScore / 100, // Convert to 0-1 scale for database
            status: 'Cover Letter Generated',
          },
        })

        return {
          success: true,
          application: updatedApplication,
          coverLetter: result.coverLetter,
          fitScore: result.fitScore,
          tone: result.tone,
        }
      } catch (error) {
        console.error('Error generating cover letter:', error)
        throw new Error(error instanceof Error ? error.message : 'Failed to generate cover letter')
      }
    }),
  create: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      company: z.string().optional(),
      title: z.string().optional(),
      coverLetter: z.string().optional(),
      fitScore: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.application.create({
        data: {
          userId: ctx.session.user.id,
          url: input.url,
          company: input.company,
          title: input.title,
          coverLetter: input.coverLetter,
          fitScore: input.fitScore,
          status: 'Applied',
        },
      })

      return application
    }),

  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const applications = await ctx.db.application.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { appliedAt: 'desc' },
      })

      return applications
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.string().optional(),
      fitScore: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.application.update({
        where: { 
          id: input.id,
          userId: ctx.session.user.id, // Ensure user can only update their own applications
        },
        data: {
          status: input.status,
          fitScore: input.fitScore,
        },
      })

      return application
    }),
})
