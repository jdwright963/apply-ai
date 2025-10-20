import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { scrapeJobPosting } from '@/lib/job-scraper'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log('Starting job analysis for URL:', url)

    // Scrape the job posting
    const jobData = await scrapeJobPosting(url)
    
    console.log('Job scraping result:', {
      success: jobData.success,
      hasData: !!jobData.data,
      error: jobData.error
    })

    if (!jobData.success || !jobData.data) {
      console.error('Job scraping failed:', jobData.error)
      return NextResponse.json({ 
        error: `Failed to scrape job posting: ${jobData.error || 'Unknown error'}` 
      }, { status: 400 })
    }

    console.log('Creating application in database...')

    // Create application in database
    const application = await db.application.create({
      data: {
        userId: session.user.id,
        url,
        company: jobData.data.company,
        title: jobData.data.title,
        description: jobData.data.description,
        location: jobData.data.location,
        salary: jobData.data.salary,
        requirements: jobData.data.requirements,
        responsibilities: jobData.data.responsibilities,
        status: 'Analyzed',
        scrapedAt: new Date(),
      },
    })

    console.log('Application created successfully:', application.id)

    return NextResponse.json({
      success: true,
      application,
      jobData: jobData.data,
    })

  } catch (error) {
    console.error('Error analyzing job posting:', error)
    return NextResponse.json(
      { error: `Failed to analyze job posting: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
