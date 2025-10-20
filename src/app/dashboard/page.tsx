'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UploadResumeCard } from '@/components/upload-resume-card'
import { JobUrlsCard } from '@/components/job-urls-card'
import { GenerateApplyButton } from '@/components/generate-apply-button'
import { JobsTable, type JobApplication } from '@/components/jobs-table'
import { HumanifyToggle } from '@/components/humanify-toggle'
import { CoverLetterModal } from '@/components/cover-letter-modal'
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

  // tRPC queries
  const { data: applications, refetch: refetchApplications } = api.application.getAll.useQuery()
  const { data: resumeData } = api.resume.get.useQuery()
  
  // tRPC mutations
  const createApplication = api.application.create.useMutation()
  const uploadResumeMutation = api.resume.upload.useMutation()
  
  // Debug logging
  console.log('Applications data:', applications)
  console.log('Is applications an array?', Array.isArray(applications))

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const handleResumeUpload = (file: File, parsedText: string) => {
    setUploadedResume(file)
    setResumeText(parsedText)
    
    // Save to database via tRPC
    uploadResumeMutation.mutate({
      fileName: file.name,
      text: parsedText,
    })
  }

  const handleUrlsChange = (urls: string[]) => {
    setJobUrls(urls)
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

  const handleGenerateAndApply = async () => {
    if (!resumeText || jobUrls.length === 0) return

    try {
      // Analyze and scrape each job posting
      const promises = jobUrls.map(async (url) => {
        try {
          // Use the new analyzeJobPosting procedure
          const result = await api.application.analyzeJobPosting.useMutation().mutateAsync({
            url,
          })
          
          return result
        } catch (error) {
          console.error(`Error analyzing job posting ${url}:`, error)
          // Fallback to basic application creation
          return createApplication.mutateAsync({
            url,
            company: 'Unknown Company',
            title: 'Unknown Title',
            fitScore: Math.floor(Math.random() * 40) + 60,
            coverLetter: `Generated cover letter for job at ${url}`,
          })
        }
      })

      await Promise.all(promises)
      
      // Refresh applications list
      await refetchApplications()
      
      // Clear job URLs after successful application
      setJobUrls([])
    } catch (error) {
      console.error('Error creating applications:', error)
    }
  }

  // Convert database applications to component format
  const jobs: JobApplication[] = Array.isArray(applications) ? applications.map(app => ({
    id: app.id,
    jobTitle: app.title || 'Unknown Title',
    company: app.company || 'Unknown Company',
    status: app.status.toLowerCase() as any,
    fitScore: Math.round((app.fitScore || 0) * 100),
    dateApplied: app.appliedAt.toISOString(),
    url: app.url,
    location: app.location || undefined,
    salary: app.salary || undefined,
    description: app.description || undefined,
  })) : []

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

          {/* Humanify Toggle */}
          <HumanifyToggle initialValue={resumeData?.humanifyMode ?? true} />

          {/* Generate & Apply Button */}
          <GenerateApplyButton
            hasResume={!!resumeText || !!resumeData?.hasResume}
            jobUrls={jobUrls}
            onGenerateAndApply={handleGenerateAndApply}
          />

          {/* Jobs Table */}
          <JobsTable 
            jobs={jobs} 
            onGenerateCoverLetter={handleOpenCoverLetterModal}
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
      </div>
    </div>
  )
}