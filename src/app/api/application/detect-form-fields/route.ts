import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectFormFields } from '@/lib/form-detector'

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

    console.log('Starting form field detection for application:', applicationId)

    // Get the application
    const application = await db.application.findUnique({
      where: { id: applicationId },
    })

    if (!application) {
      console.error('Application not found:', applicationId)
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (!application.url) {
      console.error('No URL found for application:', applicationId)
      return NextResponse.json({ error: 'No URL found for application' }, { status: 400 })
    }

    console.log('Detecting form fields for URL:', application.url)

    // Detect form fields
    const formFields = await detectFormFields(application.url)
    
    console.log('Form field detection result:', {
      success: formFields.success,
      hasData: !!formFields.data,
      error: formFields.error
    })

    if (!formFields.success || !formFields.data) {
      console.error('Form field detection failed:', formFields.error)
      return NextResponse.json({ 
        error: `Failed to detect form fields: ${formFields.error || 'Unknown error'}` 
      }, { status: 400 })
    }

    console.log('Updating application with form field data...')

    // Update application with form field data
    const updatedApplication = await db.application.update({
      where: { id: applicationId },
      data: {
        formData: formFields.data,
        status: 'Form Fields Detected',
      },
    })

    console.log('Application updated successfully:', updatedApplication.id)

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      formFields: formFields.data,
    })

  } catch (error) {
    console.error('Error detecting form fields:', error)
    return NextResponse.json(
      { error: `Failed to detect form fields: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
