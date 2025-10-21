'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Link } from 'lucide-react'

interface JobUrlsCardProps {
  onUrlsChange: (urls: string[]) => void
}

export function JobUrlsCard({ onUrlsChange }: JobUrlsCardProps) {
  const [newUrl, setNewUrl] = useState('')

  const addUrl = () => {
    if (newUrl.trim()) {
      // Call the parent with the new URL to add to the table
      onUrlsChange([newUrl.trim()])
      setNewUrl('')
    }
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
        <div className="flex items-center gap-2">
          <Input
            placeholder="https://example.com/job-posting"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={addUrl} size="sm" disabled={!newUrl.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

