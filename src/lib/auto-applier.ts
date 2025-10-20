import { chromium } from 'playwright'
import { ResumeData } from './gemini-service'
import { FormField, detectFormFields } from './form-detector'
import { sleep } from '@/utils/sleep'

export interface FormSubmissionResult {
  success: boolean
  submittedAt?: Date
  error?: string
  screenshot?: string // Base64 encoded screenshot
  finalUrl?: string
}

export interface AutoApplyOptions {
  resumeData: ResumeData
  jobDescription: string
  jobTitle: string
  company: string
  reviewBeforeSubmit: boolean
}

export async function autoApplyToJob(
  url: string,
  options: AutoApplyOptions
): Promise<FormSubmissionResult> {
  let browser: Browser | null = null
  
  try {
    browser = await chromium.launch({ 
      headless: false, // Set to true for production
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    // Navigate to the job application page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // Wait for page to load
    await page.waitForTimeout(3000)
    
    // Fill form fields
    await fillFormFields(page, options.resumeData, options)
    
    // Take screenshot before submission
    const screenshot = await page.screenshot({ 
      type: 'png',
      fullPage: true 
    })
    
    if (options.reviewBeforeSubmit) {
      // Return preview data for review
      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        finalUrl: page.url(),
      }
    }
    
    // Submit the form
    await submitForm(page)
    
    // Wait for submission to complete
    await page.waitForTimeout(5000)
    
    const finalUrl = page.url()
    const finalScreenshot = await page.screenshot({ 
      type: 'png',
      fullPage: true 
    })
    
    return {
      success: true,
      submittedAt: new Date(),
      screenshot: finalScreenshot.toString('base64'),
      finalUrl,
    }
    
  } catch (error) {
    console.error('Error in auto-apply:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to auto-apply',
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

async function fillFormFields(page: Page, resumeData: ResumeData, options: AutoApplyOptions) {
  // Fill basic personal information
  await fillField(page, 'input[name*="first"], input[id*="first"]', resumeData.personalInfo.fullName.split(' ')[0] || '')
  await fillField(page, 'input[name*="last"], input[id*="last"]', resumeData.personalInfo.fullName.split(' ').slice(1).join(' ') || '')
  await fillField(page, 'input[name*="name"], input[id*="name"]', resumeData.personalInfo.fullName)
  await fillField(page, 'input[type="email"], input[name*="email"]', resumeData.personalInfo.email || '')
  await fillField(page, 'input[type="tel"], input[name*="phone"]', resumeData.personalInfo.phone || '')
  await fillField(page, 'input[name*="location"], input[name*="address"]', resumeData.personalInfo.location || '')
  await fillField(page, 'input[name*="linkedin"]', resumeData.personalInfo.linkedin || '')
  await fillField(page, 'input[name*="github"]', resumeData.personalInfo.github || '')
  await fillField(page, 'input[name*="website"]', resumeData.personalInfo.website || '')
  
  // Fill experience
  const experienceText = resumeData.experience
    .map(exp => `${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})\n${exp.description || ''}`)
    .join('\n\n')
  await fillField(page, 'textarea[name*="experience"], textarea[name*="work"]', experienceText)
  
  // Fill education
  const educationText = resumeData.education
    .map(edu => `${edu.degree} in ${edu.field || 'N/A'} from ${edu.institution}${edu.graduationDate ? ` (${edu.graduationDate})` : ''}`)
    .join('\n')
  await fillField(page, 'textarea[name*="education"], textarea[name*="degree"]', educationText)
  
  // Fill skills
  const skillsText = resumeData.skills.join(', ')
  await fillField(page, 'textarea[name*="skill"], textarea[name*="competenc"]', skillsText)
  
  // Generate and fill cover letter
  if (resumeData.personalInfo.email && options.jobDescription) {
    try {
      const coverLetterResult = await generateCoverLetter(
        JSON.stringify(resumeData),
        options.jobDescription,
        options.jobTitle,
        options.company
      )
      
      await fillField(page, 'textarea[name*="cover"], textarea[name*="letter"]', coverLetterResult.coverLetter)
    } catch (error) {
      console.error('Failed to generate cover letter:', error)
    }
  }
  
  // Handle file uploads (resume)
  await handleFileUpload(page, resumeData)
}

async function fillField(page: Page, selector: string, value: string) {
  if (!value.trim()) return
  
  try {
    const element = await page.locator(selector).first()
    if (await element.isVisible()) {
      await element.clear()
      await element.fill(value)
      console.log(`Filled field ${selector} with: ${value.substring(0, 50)}...`)
    }
  } catch (error) {
    console.log(`Failed to fill field ${selector}:`, error)
  }
}

async function handleFileUpload(page: Page, resumeData: ResumeData) {
  try {
    const fileInput = await page.locator('input[type="file"]').first()
    if (await fileInput.isVisible()) {
      // For now, we'll skip file uploads as we need the actual file
      // In a real implementation, you'd need to provide the resume file path
      console.log('File upload field detected - skipping for now')
    }
  } catch (error) {
    console.log('No file upload field found or error:', error)
  }
}

async function submitForm(page: Page) {
  try {
    // Try different submit button selectors
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
          await button.click()
          console.log(`Clicked submit button: ${selector}`)
          return
        }
      } catch (error) {
        continue
      }
    }
    
    // If no submit button found, try pressing Enter on the last filled field
    await page.keyboard.press('Enter')
    console.log('Pressed Enter to submit form')
    
  } catch (error) {
    console.error('Error submitting form:', error)
    throw error
  }
}

// Helper function to wait for specific conditions
async function waitForCondition(page: Page, condition: () => Promise<boolean>, timeout = 10000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true
    }
    await page.waitForTimeout(100)
  }
  
  return false
}
