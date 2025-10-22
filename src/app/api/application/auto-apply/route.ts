import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { autoApplyToJob } from '@/lib/auto-applier'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { applicationId, reviewBeforeSubmit } = await request.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    console.log('Starting auto-apply for application:', applicationId)

    // Get the application with user data
    const application = await db.application.findUnique({
      where: { id: applicationId },
      include: { user: true }
    })

    if (!application) {
      console.error('Application not found:', applicationId)
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (!application.url) {
      console.error('No URL found for application:', applicationId)
      return NextResponse.json({ error: 'No URL found for application' }, { status: 400 })
    }

    if (!application.user.resumeData) {
      console.error('No resume data found for user:', application.user.id)
      return NextResponse.json({ error: 'No resume data found. Please upload a resume first.' }, { status: 400 })
    }

    if (!application.user.resumeText) {
      console.error('No raw resume text found for user:', application.user.id)
      return NextResponse.json({ error: 'No raw resume text found. Please upload a resume first.' }, { status: 400 })
    }

    console.log('Starting auto-apply process...')

    // Auto-apply to the job
    const result = await autoApplyToJob(application.url, {
      resumeData: application.user.resumeData as any,
      resumeText: application.user.resumeText, // Add raw resume text
      jobDescription: application.description || '',
      jobTitle: application.title || 'Unknown Title',
      company: application.company || 'Unknown Company',
      reviewBeforeSubmit: reviewBeforeSubmit || false,
      userPreferences: application.user.preferences, // Add user preferences
      coverLetter: application.coverLetter, // Add cover letter from database
    })

    console.log('Auto-apply result:', {
      success: result.success,
      error: result.error
    })

    if (!result.success) {
      console.error('Auto-apply failed:', result.error)
      return NextResponse.json({ 
        error: `Failed to auto-apply: ${result.error || 'Unknown error'}` 
      }, { status: 400 })
    }

    console.log('Updating application with auto-apply result...')

    // Update application with submission status
    const updatedApplication = await db.application.update({
      where: { id: applicationId },
      data: {
        status: reviewBeforeSubmit ? 'Requires Review' : 'Applied',
        submissionStatus: result.success ? 'submitted' : 'failed',
        submittedAt: result.success ? new Date() : null,
        submissionError: result.error || null,
        applicationPreview: result.screenshot ? { screenshot: result.screenshot } : null,
      },
    })

    console.log('Application updated successfully:', updatedApplication.id)

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      result,
    })

  } catch (error) {
    console.error('Error auto-applying:', error)
    return NextResponse.json(
      { error: `Failed to auto-apply: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
