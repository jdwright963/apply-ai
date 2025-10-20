import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateCoverLetter } from '@/lib/gemini-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { applicationId } = await request.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    console.log('Starting cover letter generation for application:', applicationId)

    // Get the application with user data
    const application = await db.application.findUnique({
      where: { id: applicationId },
      include: { user: true }
    })

    if (!application) {
      console.error('Application not found:', applicationId)
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (!application.user.resumeText) {
      console.error('No resume text found for user:', application.user.id)
      return NextResponse.json({ error: 'No resume found. Please upload a resume first.' }, { status: 400 })
    }

    if (!application.description) {
      console.error('No job description found for application:', applicationId)
      return NextResponse.json({ error: 'No job description found. Please analyze the job posting first.' }, { status: 400 })
    }

    console.log('Generating cover letter with Gemini...')
    console.log('Resume text length:', application.user.resumeText.length)
    console.log('Job description length:', application.description.length)

    // Generate the cover letter using Gemini
    const result = await generateCoverLetter(
      application.user.resumeText,
      application.description,
      application.title || 'Unknown Title',
      application.company || 'Unknown Company'
    )

    console.log('Cover letter generated successfully, fit score:', result.fitScore)

    // Update the application with the generated cover letter and fit score
    const updatedApplication = await db.application.update({
      where: { id: applicationId },
      data: {
        coverLetter: result.coverLetter,
        fitScore: result.fitScore / 100, // Convert to 0-1 scale for database
        status: 'Cover Letter Generated',
      },
    })

    console.log('Application updated successfully:', updatedApplication.id)

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      coverLetter: result.coverLetter,
      fitScore: result.fitScore,
      tone: result.tone,
    })

  } catch (error) {
    console.error('Error generating cover letter:', error)
    return NextResponse.json(
      { error: `Failed to generate cover letter: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
