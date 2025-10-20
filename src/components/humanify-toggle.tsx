'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Bot, User } from 'lucide-react'
import { api } from '@/utils/api'

interface HumanifyToggleProps {
  initialValue: boolean
}

export function HumanifyToggle({ initialValue }: HumanifyToggleProps) {
  const [humanifyMode, setHumanifyMode] = useState(initialValue)
  const updateHumanifyMode = api.resume.updateHumanifyMode.useMutation()

  const handleToggle = async (checked: boolean) => {
    setHumanifyMode(checked)
    try {
      await updateHumanifyMode.mutateAsync({
        humanifyMode: checked
      })
    } catch (error) {
      console.error('Error updating humanify mode:', error)
      // Revert on error
      setHumanifyMode(!checked)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {humanifyMode ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          AI Writing Style
        </CardTitle>
        <CardDescription>
          Choose how your cover letters should sound
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="humanify-mode"
            checked={humanifyMode}
            onCheckedChange={handleToggle}
            disabled={updateHumanifyMode.isPending}
          />
          <Label htmlFor="humanify-mode" className="text-sm font-medium">
            Humanify Cover Letters
          </Label>
        </div>
        
        <div className="mt-3 text-xs text-gray-600">
          {humanifyMode ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="font-medium">Natural & Conversational</span>
              </p>
              <p>• Sounds like a thoughtful person wrote it</p>
              <p>• Avoids generic AI phrases</p>
              <p>• Uses specific details and personal connections</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                <span className="font-medium">Professional & Formal</span>
              </p>
              <p>• Traditional business letter format</p>
              <p>• Structured and polished</p>
              <p>• Standard professional language</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

