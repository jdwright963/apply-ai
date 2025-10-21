import { chromium, Browser, Page } from 'playwright'
import { ResumeData, generateCoverLetter } from './gemini-service'
import { FormField, detectFormFields } from './form-detector'

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
    console.log('🚀 Starting auto-apply process...')
    console.log(`📍 URL: ${url}`)
    console.log(`👤 Job: ${options.jobTitle} at ${options.company}`)
    
    browser = await chromium.launch({ 
      headless: false, // Always visible for user review
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    console.log('🌐 Navigating to job page...')
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // Wait for page to load
    await page.waitForTimeout(3000)
    
    console.log('🔍 Detecting and clicking Apply button...')
    // Try to find and click Apply button first
    await clickApplyButton(page)
    
    console.log('📝 Auto-filling form fields...')
    // Fill form fields with resume data
    await fillFormFields(page, options.resumeData, options)
    
    console.log('✅ Auto-fill complete!')
    console.log('👀 Browser window will stay open for manual review.')
    console.log('📋 Please review the filled form and submit manually when ready.')
    console.log('❌ Close the browser window when done.')
    
    // Don't close the browser - let user review and submit manually
    return {
      success: true,
      finalUrl: page.url(),
    }
    
  } catch (error) {
    console.error('❌ Error in auto-apply:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to auto-apply',
    }
  }
  // Note: Browser stays open - user closes it manually
}

async function clickApplyButton(page: Page) {
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
  
  for (const selector of applyButtonSelectors) {
    try {
      const applyButton = await page.locator(selector).first()
      if (await applyButton.isVisible()) {
        console.log(`🎯 Found apply button: ${selector}`)
        await applyButton.click()
        await page.waitForTimeout(3000) // Wait for navigation/form to load
        console.log('✅ Apply button clicked successfully')
        return
      }
    } catch (e) {
      continue
    }
  }
  
  console.log('ℹ️ No apply button found, proceeding with current page')
}

async function fillFormFields(page: Page, resumeData: ResumeData, options: AutoApplyOptions) {
  console.log('🔍 Starting form field filling...')
  console.log('📋 Resume data available:', {
    name: resumeData.name || 'MISSING',
    email: resumeData.email || 'MISSING', 
    phone: resumeData.phone || 'MISSING',
    hasExperience: !!resumeData.experience?.length,
    hasEducation: !!resumeData.education?.length,
    hasSkills: !!resumeData.skills?.length
  })
  
  // Fill basic personal information using current ResumeData structure
  const fullName = resumeData.name || ''
  const nameParts = fullName.split(' ')
  
  // Try multiple selectors for each field type
  console.log('👤 Filling name fields...')
  await fillField(page, 'input[name*="first"], input[id*="first"], input[placeholder*="First"]', nameParts[0] || '')
  await fillField(page, 'input[name*="last"], input[id*="last"], input[placeholder*="Last"]', nameParts.slice(1).join(' ') || '')
  await fillField(page, 'input[name*="name"], input[id*="name"], input[placeholder*="Name"], input[placeholder*="Full Name"]', fullName)
  
  console.log('📧 Filling email fields...')
  await fillField(page, 'input[type="email"], input[name*="email"], input[placeholder*="Email"]', resumeData.email || '')
  
  console.log('📞 Filling phone fields...')
  await fillField(page, 'input[type="tel"], input[name*="phone"], input[placeholder*="Phone"], input[placeholder*="Number"]', resumeData.phone || '')
  
  console.log('🔗 Filling social/website fields...')
  await fillField(page, 'input[name*="linkedin"], input[placeholder*="LinkedIn"]', resumeData.linkedin || '')
  await fillField(page, 'input[name*="github"], input[placeholder*="GitHub"]', resumeData.github || '')
  await fillField(page, 'input[name*="website"], input[name*="portfolio"], input[placeholder*="Website"]', resumeData.portfolio || '')
  
  // Try a more comprehensive approach - find fields by label text
  console.log('🔍 Trying comprehensive field detection...')
  await fillFieldByLabel(page, 'Full Name', fullName)
  await fillFieldByLabel(page, 'Name', fullName)
  await fillFieldByLabel(page, 'Email', resumeData.email || '')
  await fillFieldByLabel(page, 'Phone', resumeData.phone || '')
  await fillFieldByLabel(page, 'Cover Letter', '') // Will be filled after generation
  
  // Fill experience
  if (resumeData.experience && resumeData.experience.length > 0) {
    const experienceText = resumeData.experience
      .map(exp => `${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})\n${exp.description || ''}`)
      .join('\n\n')
    await fillField(page, 'textarea[name*="experience"], textarea[name*="work"]', experienceText)
  }
  
  // Fill education
  if (resumeData.education && resumeData.education.length > 0) {
    const educationText = resumeData.education
      .map(edu => `${edu.degree} from ${edu.institution}${edu.endDate ? ` (${edu.endDate})` : ''}`)
      .join('\n')
    await fillField(page, 'textarea[name*="education"], textarea[name*="degree"]', educationText)
  }
  
  // Fill skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    const skillsText = resumeData.skills.join(', ')
    await fillField(page, 'textarea[name*="skill"], textarea[name*="competenc"]', skillsText)
  }
  
  // Generate and fill cover letter
  if (resumeData.email && options.jobDescription) {
    try {
      console.log('📝 Generating cover letter...')
      const coverLetterResult = await generateCoverLetter(
        JSON.stringify(resumeData),
        options.jobDescription,
        options.jobTitle,
        options.company
      )
      
      console.log('📄 Filling cover letter fields...')
      await fillField(page, 'textarea[name*="cover"], textarea[name*="letter"], textarea[placeholder*="Cover"], textarea[placeholder*="Letter"]', coverLetterResult.coverLetter)
      await fillFieldByLabel(page, 'Cover Letter', coverLetterResult.coverLetter)
      console.log('✅ Cover letter filled')
    } catch (error) {
      console.error('❌ Failed to generate cover letter:', error)
    }
  } else {
    console.log('⚠️ Skipping cover letter generation - missing email or job description')
  }
  
  // Handle file uploads (resume)
  await handleFileUpload(page, resumeData)
}

async function fillFieldByLabel(page: Page, labelText: string, value: string) {
  if (!value.trim()) return
  
  try {
    // Find label by text content
    const labels = await page.locator('label').all()
    
    for (const label of labels) {
      const text = await label.textContent()
      if (text && text.toLowerCase().includes(labelText.toLowerCase())) {
        // Try to find associated input/textarea
        const forAttr = await label.getAttribute('for')
        if (forAttr) {
          // Label has 'for' attribute pointing to input
          const input = await page.locator(`#${forAttr}`).first()
          if (await input.isVisible()) {
            await input.clear()
            await input.fill(value)
            console.log(`✅ Filled by label (for): ${labelText} -> #${forAttr}`)
            return
          }
        } else {
          // Try to find input/textarea as child or sibling
          const input = await label.locator('input, textarea').first()
          if (await input.isVisible()) {
            await input.clear()
            await input.fill(value)
            console.log(`✅ Filled by label (child): ${labelText}`)
            return
          }
          
          // Try next sibling
          const nextInput = await label.locator('xpath=following-sibling::input | following-sibling::textarea').first()
          if (await nextInput.isVisible()) {
            await nextInput.clear()
            await nextInput.fill(value)
            console.log(`✅ Filled by label (sibling): ${labelText}`)
            return
          }
        }
      }
    }
    
    console.log(`❌ No field found for label: ${labelText}`)
  } catch (error) {
    console.log(`❌ Error finding field by label ${labelText}: ${error}`)
  }
}

async function fillField(page: Page, selector: string, value: string) {
  if (!value.trim()) {
    console.log(`⚠️ Skipping empty field: ${selector}`)
    return
  }
  
  try {
    // Try to find the element
    const element = await page.locator(selector).first()
    const isVisible = await element.isVisible()
    
    if (isVisible) {
      // Clear and fill the field
      await element.clear()
      await element.fill(value)
      console.log(`✅ Filled ${selector}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`)
    } else {
      console.log(`❌ Field not visible: ${selector}`)
    }
  } catch (error) {
    console.log(`❌ Failed to fill ${selector}: ${error}`)
    
    // Try alternative approach - find by placeholder text
    try {
      const placeholderSelectors = selector.split(', ').map(s => s.trim())
      for (const sel of placeholderSelectors) {
        if (sel.includes('placeholder')) {
          const elements = await page.locator(sel).all()
          for (const el of elements) {
            const placeholder = await el.getAttribute('placeholder')
            if (placeholder && placeholder.toLowerCase().includes(value.toLowerCase().split(' ')[0])) {
              await el.clear()
              await el.fill(value)
              console.log(`✅ Filled by placeholder match: ${sel} (${placeholder})`)
              return
            }
          }
        }
      }
    } catch (altError) {
      console.log(`❌ Alternative approach also failed: ${altError}`)
    }
  }
}

async function handleFileUpload(page: Page, resumeData: ResumeData) {
  try {
    const fileInput = await page.locator('input[type="file"]').first()
    if (await fileInput.isVisible()) {
      console.log('📎 File upload field detected - please upload resume manually')
      // Note: For now, we'll let the user handle file uploads manually
      // In a full implementation, you'd need to provide the actual file path
    }
  } catch (error) {
    console.log('ℹ️ No file upload field found')
  }
}
