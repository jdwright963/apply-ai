'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, Send, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface ApplicationPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  applicationId: string
  jobTitle: string
  company: string
  onApplicationSubmitted: () => void
}

export function ApplicationPreviewModal({
  isOpen,
  onClose,
  applicationId,
  jobTitle,
  company,
  onApplicationSubmitted,
}: ApplicationPreviewModalProps) {
  const [reviewBeforeSubmit, setReviewBeforeSubmit] = useState(true)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDetectFormFields = async () => {
    setIsDetecting(true)
    setError(null)

    try {
      const response = await fetch('/api/application/detect-form-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ applicationId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to detect form fields')
      }

      const result = await response.json()

      if (result.success) {
        setPreviewData(result.formFields)
        console.log(`✅ Detected ${result.formFields.fields?.length || 0} form fields`)
      } else {
        setError('Failed to detect form fields')
      }
    } catch (error: any) {
      console.error('Error detecting form fields:', error)
      setError(error.message || 'Failed to detect form fields')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleAutoApply = async () => {
    setIsApplying(true)
    setError(null)

    try {
      console.log('🚀 Starting auto-apply process...')
      console.log('👀 A browser window will open - watch the auto-fill process!')
      
      const response = await fetch('/api/application/auto-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          applicationId,
          reviewBeforeSubmit 
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit application')
      }

      const result = await response.json()

      if (result.success) {
        console.log('✅ Auto-fill complete! Browser window will stay open for manual review.')
        console.log('📋 Please review the filled form and submit manually when ready.')
        console.log('❌ Close the browser window when done.')
        
        onApplicationSubmitted()
        onClose()
      } else {
        setError(result.error || 'Failed to submit application')
      }
    } catch (error: any) {
      console.error('Error auto-applying:', error)
      setError(error.message || 'Failed to submit application')
    } finally {
      setIsApplying(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Auto-Apply to {jobTitle} at {company}</DialogTitle>
          <DialogDescription>
            Review and submit your application automatically
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto space-y-6 py-4">
          {/* Enhanced Workflow Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Enhanced Auto-Apply Workflow
              </CardTitle>
              <CardDescription>
                Watch the magic happen in real-time!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">🚀 How it works:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li><strong>Click "Start Auto-Apply"</strong> → Opens visible browser window</li>
                    <li><strong>Watch auto-fill</strong> → See Playwright fill fields in real-time</li>
                    <li><strong>Review & edit</strong> → Manually adjust any fields in the browser</li>
                    <li><strong>Submit manually</strong> → Click submit button when ready</li>
                    <li><strong>Close browser</strong> → Done!</li>
                  </ol>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">✅ What gets auto-filled:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
                    <li>Personal info (name, email, phone, LinkedIn, GitHub)</li>
                    <li>Work experience and education</li>
                    <li>Skills and qualifications</li>
                    <li>AI-generated cover letter</li>
                    <li>Portfolio/website links</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">⚠️ Manual review needed for:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                    <li>Radio buttons and dropdowns</li>
                    <li>File uploads (resume, documents)</li>
                    <li>Custom questions</li>
                    <li>Salary expectations</li>
                    <li>Availability dates</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-red-700 mt-2">{error}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAutoApply}
            disabled={isApplying}
            className="bg-green-600 hover:bg-green-700"
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Auto-Apply...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Start Auto-Apply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
