'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Loader2, CheckCircle } from 'lucide-react'

interface GenerateApplyButtonProps {
  hasResume: boolean
  jobUrls: string[]
  onGenerateAndApply: () => Promise<void>
}

export function GenerateApplyButton({ hasResume, jobUrls, onGenerateAndApply }: GenerateApplyButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const validJobUrls = jobUrls.filter(url => url.trim() !== '')
  const canProcess = hasResume && validJobUrls.length > 0

  const handleGenerateAndApply = async () => {
    if (!canProcess) return

    setIsProcessing(true)
    setIsCompleted(false)

    try {
      await onGenerateAndApply()
      setIsCompleted(true)
      setTimeout(() => setIsCompleted(false), 3000) // Reset after 3 seconds
    } catch (error) {
      console.error('Error generating and applying:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Generate & Apply
        </CardTitle>
        <CardDescription>
          Generate personalized cover letters and apply to jobs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ready to apply?</p>
              <p className="text-xs text-gray-500">
                {hasResume ? '✓ Resume uploaded' : '✗ Resume required'}
                {validJobUrls.length > 0 ? ` • ✓ ${validJobUrls.length} job${validJobUrls.length !== 1 ? 's' : ''} added` : ' • ✗ Job URLs required'}
              </p>
            </div>
            <Button
              onClick={handleGenerateAndApply}
              disabled={!canProcess || isProcessing}
              size="lg"
              className="min-w-[200px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Completed!
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Generate Cover Letter + Apply
                </>
              )}
            </Button>
          </div>

          {!canProcess && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {!hasResume && validJobUrls.length === 0
                  ? 'Please upload a resume and add job URLs to get started'
                  : !hasResume
                  ? 'Please upload a resume to continue'
                  : 'Please add at least one job URL to continue'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

