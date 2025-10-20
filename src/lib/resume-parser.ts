// Keep only client-side validation helpers; parsing now happens on server route

function getFileType(fileName: string): 'pdf' | 'docx' {
  const extension = fileName.toLowerCase().split('.').pop()
  
  if (extension === 'pdf') return 'pdf'
  if (extension === 'docx') return 'docx'
  
  throw new Error('Unsupported file type. Please upload a PDF or DOCX file.')
}

export function validateResumeFile(file: File): { isValid: boolean; error?: string } {
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size must be less than 10MB'
    }
  }
  
  // Check file type
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Please upload a PDF or DOCX file'
    }
  }
  
  return { isValid: true }
}

