'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Briefcase, Calendar, TrendingUp, FileText } from 'lucide-react'

export interface JobApplication {
  id: string
  jobTitle: string
  company: string
  status: 'pending' | 'applied' | 'reviewed' | 'interview' | 'rejected' | 'offered' | 'analyzed'
  fitScore: number
  dateApplied: string
  url?: string
  location?: string
  salary?: string
  description?: string
}

interface JobsTableProps {
  jobs: JobApplication[]
  onGenerateCoverLetter: (applicationId: string, jobTitle: string, company: string) => void
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  applied: 'bg-blue-100 text-blue-800',
  reviewed: 'bg-purple-100 text-purple-800',
  interview: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-800',
  offered: 'bg-green-100 text-green-800',
  analyzed: 'bg-indigo-100 text-indigo-800',
}

const statusLabels = {
  pending: 'Pending',
  applied: 'Applied',
  reviewed: 'Reviewed',
  interview: 'Interview',
  rejected: 'Rejected',
  offered: 'Offered',
  analyzed: 'Analyzed',
}

const getFitScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

export function JobsTable({ jobs, onGenerateCoverLetter }: JobsTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Job Applications
        </CardTitle>
        <CardDescription>
          Track your job applications and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No applications yet</p>
            <p className="text-sm">Upload your resume and add job URLs to get started</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Fit Score</TableHead>
                  <TableHead className="text-right">Date Applied</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {job.url ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {job.jobTitle}
                        </a>
                      ) : (
                        job.jobTitle
                      )}
                    </TableCell>
                    <TableCell>{job.company}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[job.status]}>
                        {statusLabels[job.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className={`font-medium ${getFitScoreColor(job.fitScore)}`}>
                          {job.fitScore}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {formatDate(job.dateApplied)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGenerateCoverLetter(job.id, job.jobTitle, job.company)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Cover Letter
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
