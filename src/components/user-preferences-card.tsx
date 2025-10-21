'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Save, Settings } from 'lucide-react'

interface UserPreferences {
  gender: string
  race: string
  salaryExpectations: string
  authorizedToWorkUS: string
  handicap: string
  veteran: string
  references: string
  currentLocation: string
  willingToRelocate: string
}

const defaultPreferences: UserPreferences = {
  gender: 'I don\'t wish to answer',
  race: 'I don\'t wish to answer',
  salaryExpectations: '',
  authorizedToWorkUS: 'Yes',
  handicap: 'No',
  veteran: 'No',
  references: 'Available upon request',
  currentLocation: '',
  willingToRelocate: 'Yes'
}

export function UserPreferencesCard() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/user/preferences')
      if (response.ok) {
        const data = await response.json()
        setPreferences({ ...defaultPreferences, ...data.preferences })
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const savePreferences = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      })

      if (response.ok) {
        console.log('Preferences saved successfully')
      } else {
        console.error('Failed to save preferences')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updatePreference = (key: keyof UserPreferences, value: string) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Application Preferences
          </CardTitle>
          <CardDescription>
            Set default values for common job application questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading preferences...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Application Preferences
        </CardTitle>
        <CardDescription>
          Set default values for common job application questions. These will be used to auto-fill forms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-700">Personal Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={preferences.gender} onValueChange={(value) => updatePreference('gender', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="I don't wish to answer">I don't wish to answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="race">Race/Ethnicity</Label>
              <Select value={preferences.race} onValueChange={(value) => updatePreference('race', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="White (not Hispanic or Latino)">White (not Hispanic or Latino)</SelectItem>
                  <SelectItem value="Black or African-American (not Hispanic or Latino)">Black or African-American (not Hispanic or Latino)</SelectItem>
                  <SelectItem value="Asian (not Hispanic or Latino)">Asian (not Hispanic or Latino)</SelectItem>
                  <SelectItem value="Hispanic or Latino">Hispanic or Latino</SelectItem>
                  <SelectItem value="Two or more races/ethnicities">Two or more races/ethnicities</SelectItem>
                  <SelectItem value="I don't wish to answer">I don't wish to answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Work Authorization & Location */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-700">Work Authorization & Location</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="authorizedToWorkUS">Authorized to work in US</Label>
              <Select value={preferences.authorizedToWorkUS} onValueChange={(value) => updatePreference('authorizedToWorkUS', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentLocation">Current Location</Label>
              <Input
                id="currentLocation"
                placeholder="City, State (e.g., Denver, CO)"
                value={preferences.currentLocation}
                onChange={(e) => updatePreference('currentLocation', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="willingToRelocate">Willing to relocate</Label>
              <Select value={preferences.willingToRelocate} onValueChange={(value) => updatePreference('willingToRelocate', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Compensation & Additional Info */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-700">Compensation & Additional Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salaryExpectations">Salary Expectations</Label>
              <Input
                id="salaryExpectations"
                placeholder="e.g., $80,000-$90,000 or Negotiable"
                value={preferences.salaryExpectations}
                onChange={(e) => updatePreference('salaryExpectations', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="references">References</Label>
              <Select value={preferences.references} onValueChange={(value) => updatePreference('references', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available upon request">Available upon request</SelectItem>
                  <SelectItem value="Will provide if requested">Will provide if requested</SelectItem>
                  <SelectItem value="Can provide immediately">Can provide immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="handicap">Disability Status</Label>
              <Select value={preferences.handicap} onValueChange={(value) => updatePreference('handicap', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="I don't wish to answer">I don't wish to answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="veteran">Veteran Status</Label>
              <Select value={preferences.veteran} onValueChange={(value) => updatePreference('veteran', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="I don't wish to answer">I don't wish to answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={savePreferences} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
