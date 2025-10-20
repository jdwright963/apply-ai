import { chromium, Browser, Page } from 'playwright'
import { ResumeData } from './gemini-service'

export interface FormField {
  selector: string
  type: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio'
  fieldType: 'name' | 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website' | 'experience' | 'education' | 'skills' | 'cover_letter' | 'resume_upload' | 'other'
  label?: string
  placeholder?: string
  required?: boolean
  value?: string
  confidence: number
}

export interface DetectedForm {
  url: string
  fields: FormField[]
  submitButton?: {
    selector: string
    text: string
  }
  confidence: number
  detectedAt: Date
}

export interface FormDetectionResult {
  success: boolean
  data?: DetectedForm
  error?: string
}

// Common form field patterns for job application sites
const FORM_PATTERNS = {
  // Name fields
  firstName: [
    'input[name*="first"]',
    'input[name*="fname"]',
    'input[id*="first"]',
    'input[placeholder*="first"]',
    'input[placeholder*="First"]',
  ],
  lastName: [
    'input[name*="last"]',
    'input[name*="lname"]',
    'input[id*="last"]',
    'input[placeholder*="last"]',
    'input[placeholder*="Last"]',
  ],
  fullName: [
    'input[name*="name"]',
    'input[id*="name"]',
    'input[placeholder*="name"]',
    'input[placeholder*="Name"]',
  ],
  
  // Contact fields
  email: [
    'input[type="email"]',
    'input[name*="email"]',
    'input[id*="email"]',
    'input[placeholder*="email"]',
    'input[placeholder*="Email"]',
  ],
  phone: [
    'input[type="tel"]',
    'input[name*="phone"]',
    'input[name*="mobile"]',
    'input[id*="phone"]',
    'input[placeholder*="phone"]',
    'input[placeholder*="Phone"]',
  ],
  location: [
    'input[name*="location"]',
    'input[name*="address"]',
    'input[name*="city"]',
    'input[id*="location"]',
    'input[placeholder*="location"]',
    'input[placeholder*="Location"]',
  ],
  
  // Professional fields
  linkedin: [
    'input[name*="linkedin"]',
    'input[id*="linkedin"]',
    'input[placeholder*="linkedin"]',
    'input[placeholder*="LinkedIn"]',
  ],
  github: [
    'input[name*="github"]',
    'input[id*="github"]',
    'input[placeholder*="github"]',
    'input[placeholder*="GitHub"]',
  ],
  website: [
    'input[name*="website"]',
    'input[name*="portfolio"]',
    'input[id*="website"]',
    'input[placeholder*="website"]',
    'input[placeholder*="Website"]',
  ],
  
  // Experience fields
  experience: [
    'textarea[name*="experience"]',
    'textarea[name*="work"]',
    'textarea[id*="experience"]',
    'textarea[placeholder*="experience"]',
    'textarea[placeholder*="Experience"]',
  ],
  education: [
    'textarea[name*="education"]',
    'textarea[name*="degree"]',
    'textarea[id*="education"]',
    'textarea[placeholder*="education"]',
    'textarea[placeholder*="Education"]',
  ],
  skills: [
    'textarea[name*="skill"]',
    'textarea[name*="competenc"]',
    'textarea[id*="skill"]',
    'textarea[placeholder*="skill"]',
    'textarea[placeholder*="Skills"]',
  ],
  
  // Application fields
  coverLetter: [
    'textarea[name*="cover"]',
    'textarea[name*="letter"]',
    'textarea[id*="cover"]',
    'textarea[placeholder*="cover"]',
    'textarea[placeholder*="Cover"]',
  ],
  resumeUpload: [
    'input[type="file"]',
    'input[name*="resume"]',
    'input[name*="cv"]',
    'input[id*="resume"]',
  ],
}

// Submit button patterns
const SUBMIT_PATTERNS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Submit")',
  'button:has-text("Apply")',
  'button:has-text("Send")',
  'button:has-text("Continue")',
  'button:has-text("Next")',
  '[role="button"]:has-text("Submit")',
  '[role="button"]:has-text("Apply")',
]

export async function detectFormFields(url: string): Promise<FormDetectionResult> {
  let browser: Browser | null = null
  
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // Wait for forms to load
    await page.waitForTimeout(2000)
    
    const fields: FormField[] = []
    
    // Detect form fields using patterns
    for (const [fieldType, selectors] of Object.entries(FORM_PATTERNS)) {
      for (const selector of selectors) {
        try {
          const elements = await page.locator(selector).all()
          
          for (const element of elements) {
            const isVisible = await element.isVisible()
            if (!isVisible) continue
            
            const tagName = await element.evaluate(el => el.tagName.toLowerCase())
            const type = await element.getAttribute('type') || 'text'
            const name = await element.getAttribute('name') || ''
            const id = await element.getAttribute('id') || ''
            const placeholder = await element.getAttribute('placeholder') || ''
            const required = await element.getAttribute('required') !== null
            
            // Get label text if available
            let label = ''
            try {
              const labelElement = await page.locator(`label[for="${id}"]`).first()
              if (await labelElement.isVisible()) {
                label = await labelElement.textContent() || ''
              }
            } catch (e) {
              // Ignore label errors
            }
            
            // Calculate confidence based on multiple factors
            let confidence = 0.5
            
            // Higher confidence for exact matches
            if (name.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.3
            if (id.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.2
            if (placeholder.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.2
            
            // Type-specific confidence boosts
            if (fieldType === 'email' && type === 'email') confidence += 0.3
            if (fieldType === 'phone' && type === 'tel') confidence += 0.3
            if (fieldType === 'resumeUpload' && type === 'file') confidence += 0.4
            
            // Avoid duplicates
            const existingField = fields.find(f => f.selector === selector)
            if (existingField && existingField.confidence >= confidence) continue
            
            fields.push({
              selector,
              type: tagName as FormField['type'],
              fieldType: fieldType as FormField['fieldType'],
              label: label.trim(),
              placeholder: placeholder.trim(),
              required,
              confidence: Math.min(confidence, 1.0),
            })
          }
        } catch (e) {
          // Continue if selector fails
          continue
        }
      }
    }
    
    // Detect submit button
    let submitButton: DetectedForm['submitButton'] | undefined
    for (const selector of SUBMIT_PATTERNS) {
      try {
        const element = await page.locator(selector).first()
        if (await element.isVisible()) {
          const text = await element.textContent() || ''
          submitButton = {
            selector,
            text: text.trim(),
          }
          break
        }
      } catch (e) {
        continue
      }
    }
    
    // Calculate overall confidence
    const overallConfidence = fields.length > 0 
      ? fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length
      : 0
    
    return {
      success: true,
      data: {
        url,
        fields,
        submitButton,
        confidence: overallConfidence,
        detectedAt: new Date(),
      },
    }
    
  } catch (error) {
    console.error('Error detecting form fields:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect form fields',
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Map resume data to form fields
export function mapResumeToFormFields(resumeData: ResumeData, detectedFields: FormField[]): FormField[] {
  const mappedFields = detectedFields.map(field => {
    let value = ''
    
    switch (field.fieldType) {
      case 'name':
        value = resumeData.name || ''
        break
      case 'email':
        value = resumeData.email || ''
        break
      case 'phone':
        value = resumeData.phone || ''
        break
      case 'location':
        // Use first experience location or empty string
        value = resumeData.experience?.[0]?.location || ''
        break
      case 'linkedin':
        value = resumeData.linkedin || ''
        break
      case 'github':
        value = resumeData.github || ''
        break
      case 'website':
        value = resumeData.portfolio || ''
        break
      case 'experience':
        value = resumeData.experience
          ?.map(exp => `${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})`)
          .join('\n') || ''
        break
      case 'education':
        value = resumeData.education
          ?.map(edu => `${edu.degree} from ${edu.institution}`)
          .join('\n') || ''
        break
      case 'skills':
        value = resumeData.skills?.join(', ') || ''
        break
      case 'cover_letter':
        // This will be filled by the cover letter generation
        value = ''
        break
    }
    
    return {
      ...field,
      value,
    }
  })
  
  return mappedFields
}
