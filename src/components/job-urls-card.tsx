'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Link } from 'lucide-react'

interface JobUrlsCardProps {
  onUrlsChange: (urls: string[]) => void
}

export function JobUrlsCard({ onUrlsChange }: JobUrlsCardProps) {
  const [urls, setUrls] = useState<string[]>([''])
  const [newUrl, setNewUrl] = useState('')

  const addUrl = () => {
    if (newUrl.trim()) {
      const updatedUrls = [...urls, newUrl.trim()]
      setUrls(updatedUrls)
      onUrlsChange(updatedUrls.filter(url => url.trim() !== ''))
      setNewUrl('')
    }
  }

  const removeUrl = (index: number) => {
    const updatedUrls = urls.filter((_, i) => i !== index)
    setUrls(updatedUrls)
    onUrlsChange(updatedUrls.filter(url => url.trim() !== ''))
  }

  const updateUrl = (index: number, value: string) => {
    const updatedUrls = [...urls]
    updatedUrls[index] = value
    setUrls(updatedUrls)
    onUrlsChange(updatedUrls.filter(url => url.trim() !== ''))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addUrl()
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" />
          Job URLs
        </CardTitle>
        <CardDescription>
          Paste job posting URLs to analyze and apply to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {urls.map((url, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="https://example.com/job-posting"
                value={url}
                onChange={(e) => updateUrl(index, e.target.value)}
                className="flex-1"
              />
              {urls.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeUrl(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add another job URL..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={addUrl} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-gray-500">
          {urls.filter(url => url.trim() !== '').length} job{urls.filter(url => url.trim() !== '').length !== 1 ? 's' : ''} added
        </div>
      </CardContent>
    </Card>
  )
}

