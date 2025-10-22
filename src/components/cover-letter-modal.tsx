'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Send, Star } from 'lucide-react'
interface CoverLetterModalProps {
  isOpen: boolean
  onClose: () => void
  applicationId: string
  jobTitle: string
  company: string
  onMarkAsApplied: () => void
}

export function CoverLetterModal({
  isOpen,
  onClose,
  applicationId,
  jobTitle,
  company,
  onMarkAsApplied
}: CoverLetterModalProps) {
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [coverLetter, setCoverLetter] = useState<string>('')
  const [fitScore, setFitScore] = useState<number>(0)
  const [tone, setTone] = useState<'friendly' | 'formal'>('friendly')
  const [error, setError] = useState<string | null>(null)

  const handleGenerateCoverLetter = async () => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const response = await fetch('/api/cover-letter/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ applicationId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate cover letter')
      }

      const result = await response.json()
      
      setCoverLetter(result.coverLetter)
      setFitScore(result.fitScore)
      setTone(result.tone)
    } catch (error: any) {
      console.error('Error generating cover letter:', error)
      setError(error.message || 'Failed to generate cover letter')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyCoverLetter = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy cover letter:', error)
    }
  }

  const handleMarkAsApplied = async () => {
    try {
      const response = await fetch('/api/application/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: applicationId,
          status: 'Applied'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update application')
      }

      onMarkAsApplied()
      onClose()
    } catch (error: any) {
      console.error('Error marking as applied:', error)
      setError(error.message || 'Failed to mark as applied')
    }
  }

  const getFitScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getFitScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Cover Letter for {jobTitle} at {company}
          </DialogTitle>
          <DialogDescription>
            AI-generated personalized cover letter based on your resume and the job requirements
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Generate Button */}
          {!coverLetter && (
            <div className="text-center py-8">
              <Button
                onClick={handleGenerateCoverLetter}
                disabled={isGenerating}
                size="lg"
                className="min-w-[200px]"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Generate Cover Letter
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Cover Letter Content */}
          {coverLetter && (
            <>
              {/* Success Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">Success Score</span>
                </div>
                <Badge className={`${getFitScoreBadgeColor(fitScore)} text-sm font-medium`}>
                  {fitScore}%
                </Badge>
              </div>

              {/* Tone Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Tone:</span>
                <Badge variant="outline" className="text-xs">
                  {tone === 'friendly' ? '🤝 Friendly' : '👔 Formal'}
                </Badge>
              </div>

              {/* Cover Letter Text */}
              <div className="bg-gray-50 rounded-lg p-6 border">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                    {coverLetter}
                  </pre>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCopyCoverLetter}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Cover Letter
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleMarkAsApplied}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4" />
                  Mark as Applied
                </Button>
              </div>
            </>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">
                {error}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

