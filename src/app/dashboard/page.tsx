'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UploadResumeCard } from '@/components/upload-resume-card'
import { JobUrlsCard } from '@/components/job-urls-card'
import { JobsTable, type JobApplication } from '@/components/jobs-table'
import { CoverLetterModal } from '@/components/cover-letter-modal'
import { ApplicationPreviewModal } from '@/components/application-preview-modal'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import { api } from '@/utils/api'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [uploadedResume, setUploadedResume] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState<string>('')
  const [jobUrls, setJobUrls] = useState<string[]>([])
  const [coverLetterModal, setCoverLetterModal] = useState<{
    isOpen: boolean
    applicationId: string
    jobTitle: string
    company: string
  }>({
    isOpen: false,
    applicationId: '',
    jobTitle: '',
    company: ''
  })

  const [applicationPreviewModal, setApplicationPreviewModal] = useState<{
    isOpen: boolean
    applicationId: string
    jobTitle: string
    company: string
  }>({
    isOpen: false,
    applicationId: '',
    jobTitle: '',
    company: ''
  })

  // tRPC queries
  const { data: applications, refetch: refetchApplications } = api.application.getAll.useQuery()
  const { data: resumeData } = api.resume.get.useQuery()
  
  // Debug logging
  console.log('Applications data:', applications)
  console.log('Applications type:', typeof applications)
  console.log('Is applications an array?', Array.isArray(applications))
  console.log('Applications keys:', applications ? Object.keys(applications) : 'null/undefined')
  if (applications && typeof applications === 'object' && !Array.isArray(applications)) {
    console.log('Applications structure:', applications)
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const handleResumeUpload = (file: File, parsedText: string) => {
    setUploadedResume(file)
    setResumeText(parsedText)
    // Resume is already saved to database via REST API route
  }

  const handleUrlsChange = async (urls: string[]) => {
    // Add each URL as a new application immediately
    for (const url of urls) {
      if (url.trim()) {
        try {
          const response = await fetch('/api/application/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: url.trim(),
              company: 'Analyzing...',
              title: 'Analyzing...',
              fitScore: 0,
              coverLetter: '',
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create application')
          }

          console.log('Application created successfully for URL:', url)
        } catch (error) {
          console.error('Error creating application for URL:', url, error)
        }
      }
    }
    
    // Refresh the applications list to show the new entries
    await refetchApplications()
    
    // Clear the jobUrls state since we're now managing them in the database
    setJobUrls([])
  }

  const handleMarkAsApplied = async () => {
    await refetchApplications()
  }

  const handleOpenCoverLetterModal = (applicationId: string, jobTitle: string, company: string) => {
    setCoverLetterModal({
      isOpen: true,
      applicationId,
      jobTitle,
      company
    })
  }

  const handleCloseCoverLetterModal = () => {
    setCoverLetterModal({
      isOpen: false,
      applicationId: '',
      jobTitle: '',
      company: ''
    })
  }

  const handleOpenApplicationPreviewModal = (applicationId: string, jobTitle: string, company: string) => {
    setApplicationPreviewModal({
      isOpen: true,
      applicationId,
      jobTitle,
      company
    })
  }

  const handleCloseApplicationPreviewModal = () => {
    setApplicationPreviewModal({
      isOpen: false,
      applicationId: '',
      jobTitle: '',
      company: ''
    })
  }

  // Convert database applications to component format
  const jobs: JobApplication[] = (() => {
    if (!applications) return []
    
    // Handle case where applications might be wrapped in an object
    let appsArray = applications
    if (typeof applications === 'object' && !Array.isArray(applications)) {
      // Check if it's wrapped in a json property (tRPC format)
      if ('json' in applications && Array.isArray(applications.json)) {
        appsArray = applications.json
      } else if ('data' in applications && Array.isArray(applications.data)) {
        appsArray = applications.data
      } else if ('applications' in applications && Array.isArray(applications.applications)) {
        appsArray = applications.applications
      } else {
        console.error('Applications is not an array and no array property found:', applications)
        return []
      }
    }
    
    if (!Array.isArray(appsArray)) {
      console.error('appsArray is still not an array:', appsArray)
      return []
    }
    
    return appsArray.map(app => ({
      id: app.id,
      jobTitle: app.title || 'Unknown Title',
      company: app.company || 'Unknown Company',
      status: app.status.toLowerCase() as any,
      fitScore: Math.round((app.fitScore || 0) * 100),
      dateApplied: app.appliedAt ? new Date(app.appliedAt).toISOString() : new Date().toISOString(),
      url: app.url,
      location: app.location || undefined,
      salary: app.salary || undefined,
      description: app.description || undefined,
      autoApplyEnabled: app.autoApplyEnabled || false,
      submissionStatus: app.submissionStatus as any,
      submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : undefined,
    }))
  })()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Apply AI Dashboard</h1>
              <p className="text-sm text-gray-600">Automate your job applications</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                {session.user?.email}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Upload Resume and Job URLs Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UploadResumeCard onResumeUpload={handleResumeUpload} />
            <JobUrlsCard onUrlsChange={handleUrlsChange} />
          </div>

          {/* Jobs Table */}
          <JobsTable 
            jobs={jobs} 
            onGenerateCoverLetter={handleOpenCoverLetterModal}
            onAutoApply={handleOpenApplicationPreviewModal}
          />
        </div>

        {/* Cover Letter Modal */}
        <CoverLetterModal
          isOpen={coverLetterModal.isOpen}
          onClose={handleCloseCoverLetterModal}
          applicationId={coverLetterModal.applicationId}
          jobTitle={coverLetterModal.jobTitle}
          company={coverLetterModal.company}
          onMarkAsApplied={handleMarkAsApplied}
        />

        {/* Application Preview Modal */}
        <ApplicationPreviewModal
          isOpen={applicationPreviewModal.isOpen}
          onClose={handleCloseApplicationPreviewModal}
          applicationId={applicationPreviewModal.applicationId}
          jobTitle={applicationPreviewModal.jobTitle}
          company={applicationPreviewModal.company}
          onApplicationSubmitted={handleMarkAsApplied}
        />
      </div>
    </div>
  )
}