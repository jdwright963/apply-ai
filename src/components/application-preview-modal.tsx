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
          {/* Form Detection Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Form Detection
              </CardTitle>
              <CardDescription>
                Detect and analyze the application form fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleDetectFormFields}
                disabled={isDetecting}
                className="w-full"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Detecting Form Fields...
                  </>
                ) : (
                  'Detect Form Fields'
                )}
              </Button>

              {previewData && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {previewData.fields?.length || 0} Fields Detected
                    </Badge>
                    <Badge variant="outline">
                      Confidence: {Math.round((previewData.confidence || 0) * 100)}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewData.fields?.map((field: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {field.label || field.placeholder || field.fieldType}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(field.confidence * 100)}%
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600">
                          {field.type} • {field.fieldType}
                          {field.required && ' • Required'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Preview Section */}
          {previewData && (
            <Card>
              <CardHeader>
                <CardTitle>Application Preview</CardTitle>
                <CardDescription>
                  Review the detected form fields before submission
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previewData.screenshot && (
                  <div className="mb-4">
                    <img 
                      src={`data:image/png;base64,${previewData.screenshot}`}
                      alt="Application Preview"
                      className="w-full border rounded-lg"
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="review-before-submit"
                      checked={reviewBeforeSubmit}
                      onCheckedChange={(checked) => setReviewBeforeSubmit(checked as boolean)}
                    />
                    <Label htmlFor="review-before-submit">
                      Review application before submitting
                    </Label>
                  </div>

                  <Separator />

                  <div className="text-sm text-gray-600">
                    <p className="mb-2">
                      <strong>Note:</strong> This will automatically fill out the application form with your resume data and submit it.
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Personal information will be filled from your resume</li>
                      <li>Cover letter will be generated using AI</li>
                      <li>Experience and education will be populated</li>
                      <li>Form will be submitted automatically</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
            disabled={isApplying || !previewData}
            className="bg-green-600 hover:bg-green-700"
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Application...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Application
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
