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
    'input[name*="given"]',
    'input[id*="given"]',
  ],
  lastName: [
    'input[name*="last"]',
    'input[name*="lname"]',
    'input[id*="last"]',
    'input[placeholder*="last"]',
    'input[placeholder*="Last"]',
    'input[name*="surname"]',
    'input[id*="surname"]',
    'input[name*="family"]',
    'input[id*="family"]',
  ],
  fullName: [
    'input[name*="name"]',
    'input[id*="name"]',
    'input[placeholder*="name"]',
    'input[placeholder*="Name"]',
    'input[name*="fullname"]',
    'input[id*="fullname"]',
    'input[name*="applicant"]',
    'input[id*="applicant"]',
  ],
  
  // Contact fields
  email: [
    'input[type="email"]',
    'input[name*="email"]',
    'input[id*="email"]',
    'input[placeholder*="email"]',
    'input[placeholder*="Email"]',
    'input[name*="e-mail"]',
    'input[id*="e-mail"]',
  ],
  phone: [
    'input[type="tel"]',
    'input[name*="phone"]',
    'input[name*="mobile"]',
    'input[name*="telephone"]',
    'input[id*="phone"]',
    'input[id*="mobile"]',
    'input[id*="telephone"]',
    'input[placeholder*="phone"]',
    'input[placeholder*="Phone"]',
    'input[placeholder*="mobile"]',
    'input[placeholder*="Mobile"]',
  ],
  location: [
    'input[name*="location"]',
    'input[name*="address"]',
    'input[name*="city"]',
    'input[name*="state"]',
    'input[name*="zip"]',
    'input[name*="postal"]',
    'input[id*="location"]',
    'input[id*="address"]',
    'input[id*="city"]',
    'input[placeholder*="location"]',
    'input[placeholder*="Location"]',
    'input[placeholder*="address"]',
    'input[placeholder*="Address"]',
  ],
  
  // Professional fields
  linkedin: [
    'input[name*="linkedin"]',
    'input[id*="linkedin"]',
    'input[placeholder*="linkedin"]',
    'input[placeholder*="LinkedIn"]',
    'input[name*="linked"]',
    'input[id*="linked"]',
  ],
  github: [
    'input[name*="github"]',
    'input[id*="github"]',
    'input[placeholder*="github"]',
    'input[placeholder*="GitHub"]',
    'input[name*="git"]',
    'input[id*="git"]',
  ],
  website: [
    'input[name*="website"]',
    'input[name*="portfolio"]',
    'input[name*="url"]',
    'input[id*="website"]',
    'input[id*="portfolio"]',
    'input[id*="url"]',
    'input[placeholder*="website"]',
    'input[placeholder*="Website"]',
    'input[placeholder*="portfolio"]',
    'input[placeholder*="Portfolio"]',
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
    'input[name*="document"]',
    'input[id*="resume"]',
    'input[id*="cv"]',
    'input[id*="document"]',
  ],
  
  // Generic fallback patterns
  other: [
    'input[type="text"]',
    'input[type="password"]',
    'textarea',
    'select',
    'input:not([type])',
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

export interface DetailedFormField {
  selector: string
  type: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio'
  inputType?: string // text, email, tel, password, etc.
  name?: string
  id?: string
  placeholder?: string
  label?: string
  required?: boolean
  value?: string
  options?: string[] // For select/radio fields
  description?: string // Additional context about the field
}

export interface DetailedFormInfo {
  url: string
  pageTitle: string
  fields: DetailedFormField[]
  submitButton?: {
    selector: string
    text: string
  }
  detectedAt: Date
}

export interface DetailedFormDetectionResult {
  success: boolean
  data?: DetailedFormInfo
  error?: string
}

export async function scrapeDetailedFormFields(url: string): Promise<DetailedFormDetectionResult> {
  let browser: Browser | null = null
  
  try {
    browser = await chromium.launch({ 
      headless: false, // Visible for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Try to find and click "Apply" buttons to get to the actual application form
    const applyButtonSelectors = [
      'button:has-text("Apply")', 'a:has-text("Apply")',
      'button:has-text("Apply Now")', 'a:has-text("Apply Now")',
      'button:has-text("Easy Apply")', 'a:has-text("Easy Apply")',
      'button:has-text("Submit Application")', 'a:has-text("Submit Application")',
      'button:has-text("Apply for this job")', 'a:has-text("Apply for this job")',
      '[data-testid*="apply"]', '[class*="apply"]',
      'button[aria-label*="apply" i]', 'a[aria-label*="apply" i]',
    ]
    
    let foundApplyButton = false
    for (const selector of applyButtonSelectors) {
      try {
        const applyButton = await page.locator(selector).first()
        if (await applyButton.isVisible()) {
          console.log(`Found apply button with selector: ${selector}`)
          await applyButton.click()
          await page.waitForTimeout(3000) // Wait for navigation or form to load
          const currentUrl = page.url()
          if (currentUrl !== url) {
            console.log(`Navigated to application page: ${currentUrl}`)
          }
          foundApplyButton = true
          break
        }
      } catch (e) {
        continue
      }
    }
    
    if (!foundApplyButton) {
      console.log('No apply button found, proceeding with current page')
    }
    
    await page.waitForTimeout(2000) // Wait a bit more for any dynamic content to load
    
    const fields: DetailedFormField[] = []
    
    // Get all form elements
    const formElements = await page.locator('input, textarea, select').all()
    
    for (const element of formElements) {
      try {
        const isVisible = await element.isVisible()
        if (!isVisible) continue
        
        const tagName = await element.evaluate(el => el.tagName.toLowerCase())
        const type = await element.getAttribute('type') || 'text'
        const name = await element.getAttribute('name') || ''
        const id = await element.getAttribute('id') || ''
        const placeholder = await element.getAttribute('placeholder') || ''
        const required = await element.getAttribute('required') !== null
        const value = await element.getAttribute('value') || ''
        
        // Get label text
        let label = ''
        try {
          if (id) {
            const labelElement = await page.locator(`label[for="${id}"]`).first()
            if (await labelElement.isVisible()) {
              label = await labelElement.textContent() || ''
            }
          }
          
          if (!label) {
            // Try parent label
            const parentLabel = await element.locator('xpath=..').locator('label').first()
            if (await parentLabel.isVisible()) {
              label = await parentLabel.textContent() || ''
            }
          }
          
          if (!label) {
            // Try previous sibling label
            const prevLabel = await element.locator('xpath=preceding-sibling::label[1]').first()
            if (await prevLabel.isVisible()) {
              label = await prevLabel.textContent() || ''
            }
          }
        } catch (e) {
          // Ignore label errors
        }
        
        // Get options for select/radio fields
        let options: string[] = []
        if (tagName === 'select') {
          const optionElements = await element.locator('option').all()
          for (const option of optionElements) {
            const optionText = await option.textContent()
            if (optionText && optionText.trim()) {
              options.push(optionText.trim())
            }
          }
        }
        
        // Generate selector
        let selector = ''
        if (id) {
          selector = `#${id}`
        } else if (name) {
          selector = `[name="${name}"]`
        } else {
          selector = `${tagName}[type="${type}"]`
        }
        
        fields.push({
          selector,
          type: tagName as any,
          inputType: type,
          name,
          id,
          placeholder: placeholder.trim(),
          label: label.trim(),
          required,
          value: value.trim(),
          options,
          description: `${label || placeholder || name || 'Field'} (${type})`
        })
        
        console.log(`Detected field: ${label || placeholder || name} (${tagName}[${type}])`)
      } catch (e) {
        continue
      }
    }
    
    // Find submit button
    let submitButton: { selector: string; text: string } | undefined
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
      'button:has-text("Send")',
      'button:has-text("Continue")',
      'button:has-text("Next")',
    ]
    
    for (const selector of submitSelectors) {
      try {
        const button = await page.locator(selector).first()
        if (await button.isVisible()) {
          const text = await button.textContent() || ''
          submitButton = { selector, text: text.trim() }
          break
        }
      } catch (e) {
        continue
      }
    }
    
    const pageTitle = await page.title()
    
    console.log(`Detailed form detection complete: ${fields.length} fields detected`)
    console.log(`Current URL: ${page.url()}`)
    console.log(`Page title: ${pageTitle}`)
    
    return {
      success: true,
      data: {
        url: page.url(),
        pageTitle,
        fields,
        submitButton,
        detectedAt: new Date(),
      },
    }
    
  } catch (error) {
    console.error('Error detecting detailed form fields:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect form fields',
    }
  } finally {
    if (browser) {
      // browser.close() // Keep browser open for manual review
    }
  }
}

export async function detectFormFields(url: string): Promise<FormDetectionResult> {
  let browser: Browser | null = null
  
  try {
    browser = await chromium.launch({ 
      headless: false, // Visible for user to see detection process
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Try to find and click "Apply" buttons to get to the actual application form
    const applyButtonSelectors = [
      'button:has-text("Apply")',
      'a:has-text("Apply")',
      'button:has-text("Apply Now")',
      'a:has-text("Apply Now")',
      'button:has-text("Easy Apply")',
      'a:has-text("Easy Apply")',
      'button:has-text("Submit Application")',
      'a:has-text("Submit Application")',
      'button:has-text("Apply for this job")',
      'a:has-text("Apply for this job")',
      '[data-testid*="apply"]',
      '[class*="apply"]',
      'button[aria-label*="apply" i]',
      'a[aria-label*="apply" i]',
    ]
    
    let foundApplyButton = false
    for (const selector of applyButtonSelectors) {
      try {
        const applyButton = await page.locator(selector).first()
        if (await applyButton.isVisible()) {
          console.log(`Found apply button with selector: ${selector}`)
          
          // Click the apply button
          await applyButton.click()
          
          // Wait for navigation or form to load
          await page.waitForTimeout(3000)
          
          // Check if we navigated to a new page or if a form appeared
          const currentUrl = page.url()
          if (currentUrl !== url) {
            console.log(`Navigated to application page: ${currentUrl}`)
          }
          
          foundApplyButton = true
          break
        }
      } catch (e) {
        // Continue trying other selectors
        continue
      }
    }
    
    if (!foundApplyButton) {
      console.log('No apply button found, proceeding with current page')
    }
    
    // Wait a bit more for any dynamic content to load
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
              // Try to find parent label
              try {
                const parentLabel = await element.locator('xpath=..').locator('label').first()
                if (await parentLabel.isVisible()) {
                  label = await parentLabel.textContent() || ''
                }
              } catch (e2) {
                // Ignore label errors
              }
            }
            
            // Calculate confidence based on multiple factors
            let confidence = 0.3 // Base confidence
            
            // Higher confidence for exact matches
            if (name.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.3
            if (id.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.2
            if (placeholder.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.2
            if (label.toLowerCase().includes(fieldType.toLowerCase())) confidence += 0.2
            
            // Type-specific confidence boosts
            if (fieldType === 'email' && type === 'email') confidence += 0.3
            if (fieldType === 'phone' && type === 'tel') confidence += 0.3
            if (fieldType === 'resumeUpload' && type === 'file') confidence += 0.4
            
            // Boost confidence for visible, interactive elements
            if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
              confidence += 0.1
            }
            
            // Avoid duplicates - check if we already have this field with higher confidence
            const existingField = fields.find(f => f.selector === selector)
            if (existingField && existingField.confidence >= confidence) continue
            
            // Only add fields with reasonable confidence
            if (confidence >= 0.4) {
              fields.push({
                selector,
                type: tagName as FormField['type'],
                fieldType: fieldType as FormField['fieldType'],
                label: label.trim(),
                placeholder: placeholder.trim(),
                required,
                confidence: Math.min(confidence, 1.0),
              })
              
              console.log(`Detected field: ${fieldType} (${tagName}) - confidence: ${Math.round(confidence * 100)}%`)
            }
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
    
    console.log(`Form detection complete: ${fields.length} fields detected, overall confidence: ${Math.round(overallConfidence * 100)}%`)
    console.log(`Current URL: ${page.url()}`)
    console.log(`Page title: ${await page.title()}`)
    
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
