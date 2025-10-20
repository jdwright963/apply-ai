import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { scrapeJobPosting } from '@/lib/job-scraper'
import { generateCoverLetter } from '@/lib/gemini-service'
import { ResumeDataSchema } from '@/lib/gemini-service'
import { detectFormFields } from '@/lib/form-detector'
import { autoApplyToJob } from '@/lib/auto-applier'

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

        // Generate the cover letter using Gemini
        const result = await generateCoverLetter(
          application.user.resumeText,
          application.description,
          application.title || 'Unknown Title',
          application.company || 'Unknown Company'
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

  detectFormFields: protectedProcedure
    .input(z.object({
      url: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await detectFormFields(input.url)
        
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to detect form fields')
        }

        // Update application with detected form fields
        await ctx.db.application.updateMany({
          where: {
            url: input.url,
            userId: ctx.session.user.id,
          },
          data: {
            formData: result.data,
          },
        })

        return {
          success: true,
          formData: result.data,
        }
      } catch (error) {
        console.error('Error detecting form fields:', error)
        throw new Error(error instanceof Error ? error.message : 'Failed to detect form fields')
      }
    }),

  autoApply: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      reviewBeforeSubmit: z.boolean().default(true),
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
                resumeData: true,
                humanifyMode: true,
              },
            },
          },
        })

        if (!application) {
          throw new Error('Application not found')
        }

        if (!application.user.resumeData) {
          throw new Error('No structured resume data found. Please upload a resume first.')
        }

        if (!application.description) {
          throw new Error('No job description found. Please analyze the job posting first.')
        }

        // Parse resume data
        const resumeData = ResumeDataSchema.parse(application.user.resumeData)

        // Perform auto-application
        const result = await autoApplyToJob(application.url, {
          resumeData,
          jobDescription: application.description,
          jobTitle: application.title || 'Unknown Title',
          company: application.company || 'Unknown Company',
          humanifyMode: application.user.humanifyMode,
          reviewBeforeSubmit: input.reviewBeforeSubmit,
        })

        // Update application with results
        const updatedApplication = await ctx.db.application.update({
          where: {
            id: input.applicationId,
          },
          data: {
            autoApplyEnabled: true,
            applicationPreview: result.success ? {
              screenshot: result.screenshot,
              finalUrl: result.finalUrl,
              submittedAt: result.submittedAt,
            } : null,
            submittedAt: result.submittedAt,
            submissionStatus: result.success ? 'submitted' : 'failed',
            submissionError: result.error,
          },
        })

        return {
          success: result.success,
          application: updatedApplication,
          screenshot: result.screenshot,
          finalUrl: result.finalUrl,
          submittedAt: result.submittedAt,
          error: result.error,
        }
      } catch (error) {
        console.error('Error in auto-apply:', error)
        throw new Error(error instanceof Error ? error.message : 'Failed to auto-apply')
      }
    }),

  updateSubmissionStatus: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      status: z.enum(['pending', 'submitted', 'failed', 'requires_review']),
      error: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.application.update({
        where: {
          id: input.applicationId,
          userId: ctx.session.user.id,
        },
        data: {
          submissionStatus: input.status,
          submissionError: input.error,
          submittedAt: input.status === 'submitted' ? new Date() : undefined,
        },
      })

      return application
    }),
})
