import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, company, title, fitScore, coverLetter } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log('Creating application for URL:', url)

    // Create application in database
    const application = await db.application.create({
      data: {
        userId: session.user.id,
        url,
        company: company || 'Analyzing...',
        title: title || 'Analyzing...',
        description: '',
        fitScore: fitScore || 0,
        coverLetter: coverLetter || '',
        status: 'Pending',
        appliedAt: new Date(),
      },
    })

    console.log('Application created successfully:', application.id)

    return NextResponse.json({
      success: true,
      application,
    })

  } catch (error) {
    console.error('Error creating application:', error)
    return NextResponse.json(
      { error: `Failed to create application: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
