'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X, Loader2 } from 'lucide-react'
// client-side validation only; parsing happens on server route
import { validateResumeFile } from '@/lib/resume-parser'

interface UploadResumeCardProps {
  onResumeUpload: (file: File, parsedText: string) => void
}

export function UploadResumeCard({ onResumeUpload }: UploadResumeCardProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (file: File) => {
    setError(null)
    
    // Validate file
    const validation = validateResumeFile(file)
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file')
      return
    }

    setIsProcessing(true)
    
    try {
      // Upload to server for parsing
      const body = new FormData()
      body.append('resume', file)

      const res = await fetch('/api/resume/upload', {
        method: 'POST',
        body,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      setUploadedFile(file)
      onResumeUpload(file, 'uploaded')
    } catch (error) {
      console.error('Error parsing resume:', error)
      setError('Failed to parse resume. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setError(null)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Resume
        </CardTitle>
        <CardDescription>
          Upload your resume in PDF or Word format to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!uploadedFile && !isProcessing ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop your resume here, or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supports PDF and Word documents (max 10MB)
            </p>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileInput}
              className="hidden"
              id="resume-upload"
              disabled={isProcessing}
            />
            <Button asChild disabled={isProcessing}>
              <label htmlFor="resume-upload" className="cursor-pointer">
                Choose File
              </label>
            </Button>
          </div>
        ) : isProcessing ? (
          <div className="flex items-center justify-center p-8 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 mx-auto text-blue-600 animate-spin mb-4" />
              <p className="text-blue-900 font-medium">Processing resume...</p>
              <p className="text-blue-700 text-sm">Extracting text content</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-900">{uploadedFile?.name}</p>
                <p className="text-sm text-green-600">
                  {(uploadedFile?.size ? uploadedFile.size / 1024 / 1024 : 0).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeFile}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
