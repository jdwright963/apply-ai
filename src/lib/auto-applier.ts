import { chromium, Browser, Page } from 'playwright'
import { ResumeData, generateCoverLetter, analyzeFormScreenshots } from './gemini-service'

export interface FormSubmissionResult {
  success: boolean
  submittedAt?: Date
  error?: string
  screenshot?: string // Base64 encoded screenshot
  finalUrl?: string
}

export interface AutoApplyOptions {
  resumeData: ResumeData
  resumeText: string // Add raw resume text
  jobDescription: string
  jobTitle: string
  company: string
  reviewBeforeSubmit: boolean
  userPreferences?: any // User preferences for common form fields
  coverLetter?: string // Cover letter from database
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
    
    await page.waitForTimeout(3000) // Wait for page to load
    
    console.log('🔍 Detecting and clicking Apply button...')
    // Try to find and click Apply button first
    await clickApplyButton(page)
    
    console.log('📝 Auto-filling form fields...')
    
    console.log('📸 Capturing form screenshots...')
    const screenshots = await captureFormScreenshots(page)
    console.log(`📷 Captured ${screenshots.length} screenshot(s)`)
    
    console.log('🤖 Analyzing form with Gemini Vision...')
    const analysisResult = await analyzeFormScreenshots(
      screenshots,
      options.resumeText,
      options.jobDescription,
      options.userPreferences,
      options.coverLetter
    )
    
    if (!analysisResult.success) {
      throw new Error(analysisResult.error || 'Failed to analyze form screenshots')
    }
    
    console.log(`✅ Generated ${analysisResult.instructions.length} fill instructions`)
    
    console.log('📝 Scraping actual form fields...')
    const formFields = await scrapeFormFields(page)
    console.log(`🔍 Found ${formFields.length} form fields on page`)
    
    console.log('🔗 Matching Gemini labels to Playwright selectors...')
    const matchedInstructions = matchLabelsToSelectors(analysisResult.instructions, formFields)
    console.log(`✅ Matched ${matchedInstructions.length} fields`)
    
    console.log('📝 Filling form fields with matched instructions...')
    await fillFormWithInstructions(page, matchedInstructions, options)
    
    console.log('✅ Screenshot-based form filling complete!')
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

async function captureFormScreenshots(page: Page): Promise<Buffer[]> {
  console.log('📸 Starting screenshot capture...')
  const screenshots: Buffer[] = []
  
  // Scroll to top first
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1000)
  
  // Get viewport height
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  const documentHeight = await page.evaluate(() => document.body.scrollHeight)
  
  console.log(`📏 Viewport height: ${viewportHeight}px, Document height: ${documentHeight}px`)
  
  let currentScroll = 0
  let screenshotCount = 0
  
  while (currentScroll < documentHeight) {
    console.log(`📷 Taking screenshot ${screenshotCount + 1} at scroll position ${currentScroll}px`)
    
    // Take screenshot of current viewport
    const screenshot = await page.screenshot({ 
      fullPage: false, // Just viewport
      type: 'png'
    })
    screenshots.push(screenshot)
    screenshotCount++
    
    // Check if there's more content below
    const remainingHeight = documentHeight - (currentScroll + viewportHeight)
    if (remainingHeight <= 0) {
      console.log('✅ Reached end of document')
      break
    }
    
    // Scroll down by viewport height
    currentScroll += viewportHeight
    await page.evaluate((scroll) => window.scrollTo(0, scroll), currentScroll)
    await page.waitForTimeout(1000) // Let content load
    
    // Safety check to prevent infinite loops
    if (screenshotCount > 10) {
      console.log('⚠️ Reached maximum screenshot limit (10)')
      break
    }
  }
  
  console.log(`✅ Captured ${screenshots.length} screenshot(s)`)
  return screenshots
}

async function fillFormWithInstructions(page: Page, instructions: MatchedInstruction[], options: AutoApplyOptions) {
  console.log('🎯 Filling form with matched instructions...')
  
  for (const instruction of instructions) {
    try {
      const { fieldDescription, action, value, selector, confidence, reasoning, matchConfidence } = instruction
      
      if (!value || value.trim() === '' || value === 'N/A') {
        console.log(`⏭️ Skipping empty field: ${fieldDescription}`)
        continue
      }
      
      if (confidence < 0.5) {
        console.log(`⚠️ Low confidence (${Math.round(confidence * 100)}%) for ${fieldDescription}: ${reasoning}`)
        continue
      }
      
      if (matchConfidence < 0.5) {
        console.log(`⚠️ Low match confidence (${Math.round(matchConfidence * 100)}%) for ${fieldDescription}`)
        continue
      }
      
      console.log(`🔍 Filling field: ${fieldDescription} using selector: ${selector}`)
      
      if (action === 'fill') {
        // Fill text input
        const element = await page.locator(selector).first()
        const isVisible = await element.isVisible()
        
        if (isVisible) {
          try {
            await element.scrollIntoViewIfNeeded()
            await page.waitForTimeout(500)
          } catch (scrollError) {
            console.log(`⚠️ Could not scroll to element: ${scrollError}`)
          }
          
          await element.clear()
          
          // Special handling for cover letter
          const fillValue = value === '[COVER_LETTER_FROM_DATABASE]' 
            ? (options.coverLetter || '') 
            : value
          
          await element.fill(fillValue)
          console.log(`✅ Filled ${fieldDescription} (${Math.round(confidence * 100)}%): ${fillValue.substring(0, 50)}${fillValue.length > 50 ? '...' : ''}`)
          console.log(`   Reasoning: ${reasoning}`)
        } else {
          console.log(`❌ Field not visible: ${fieldDescription} (${selector})`)
        }
        
      } else if (action === 'click') {
        // Click radio button or checkbox
        const element = await page.locator(selector).first()
        const isVisible = await element.isVisible()
        
        if (isVisible) {
          try {
            await element.scrollIntoViewIfNeeded()
            await page.waitForTimeout(500)
          } catch (scrollError) {
            console.log(`⚠️ Could not scroll to element: ${scrollError}`)
          }
          
          await element.click()
          console.log(`✅ Clicked ${fieldDescription} (${Math.round(confidence * 100)}%): ${value}`)
          console.log(`   Reasoning: ${reasoning}`)
        } else {
          console.log(`❌ Field not visible: ${fieldDescription} (${selector})`)
        }
        
      } else if (action === 'select') {
        // Select dropdown option
        const element = await page.locator(selector).first()
        const isVisible = await element.isVisible()
        
        if (isVisible) {
          try {
            await element.scrollIntoViewIfNeeded()
            await page.waitForTimeout(500)
          } catch (scrollError) {
            console.log(`⚠️ Could not scroll to element: ${scrollError}`)
          }
          
          await element.selectOption(value)
          console.log(`✅ Selected ${fieldDescription} (${Math.round(confidence * 100)}%): ${value}`)
          console.log(`   Reasoning: ${reasoning}`)
        } else {
          console.log(`❌ Field not visible: ${fieldDescription} (${selector})`)
        }
      }
      
    } catch (error) {
      console.log(`❌ Failed to fill ${instruction.fieldDescription}: ${error}`)
    }
  }
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

async function handleFileUpload(page: Page) {
  try {
    const fileInput = await page.locator('input[type="file"]').first()
    if (await fileInput.isVisible()) {
      console.log('📎 File upload field detected - please upload resume manually')
    }
  } catch (error) {
    console.log('ℹ️ No file upload field found')
  }
}

// Form scraping and matching functions
async function scrapeFormFields(page: Page): Promise<FormField[]> {
  console.log('🔍 Scraping form fields from DOM...')
  
  const formFields = await page.evaluate(() => {
    const fields: any[] = []
    
    // Find all form inputs
    const inputs = document.querySelectorAll('input, textarea, select')
    
    inputs.forEach((input, index) => {
      const element = input as HTMLElement
      const tagName = element.tagName.toLowerCase()
      const type = element.getAttribute('type') || 'text'
      const name = element.getAttribute('name') || ''
      const id = element.getAttribute('id') || ''
      const placeholder = element.getAttribute('placeholder') || ''
      const className = element.getAttribute('class') || ''
      
      // Skip hidden fields
      if (type === 'hidden') return
      
      // Find associated label
      let labelText = ''
      let labelElement = null
      
      // Strategy 1: Input inside label
      labelElement = element.closest('label')
      if (labelElement) {
        labelText = labelElement.textContent?.trim() || ''
      }
      
      // Strategy 2: Label with 'for' attribute pointing to this input
      if (!labelText && id) {
        labelElement = document.querySelector(`label[for="${id}"]`)
        if (labelElement) {
          labelText = labelElement.textContent?.trim() || ''
        }
      }
      
      // Strategy 3: Look for nearby text that might be a label
      if (!labelText) {
        // Look in parent container for text
        const parent = element.parentElement
        if (parent) {
          const textNodes = Array.from(parent.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent?.trim())
            .filter(text => text && text.length > 0)
          
          if (textNodes.length > 0) {
            labelText = textNodes[0] || ''
          }
        }
      }
      
      // Strategy 4: Look for previous sibling text
      if (!labelText) {
        let sibling = element.previousElementSibling
        while (sibling && !labelText) {
          if (sibling.tagName.toLowerCase() === 'label') {
            labelText = sibling.textContent?.trim() || ''
          } else if (sibling.textContent?.trim()) {
            labelText = sibling.textContent.trim()
          }
          sibling = sibling.previousElementSibling
        }
      }
      
      // Clean up label text (remove asterisks, extra whitespace)
      labelText = labelText.replace(/\s*\*\s*$/, '').trim()
      
      // Generate selector
      let selector = ''
      if (id) {
        selector = `#${id}`
      } else if (name) {
        selector = `${tagName}[name="${name}"]`
      } else {
        selector = `${tagName}:nth-of-type(${index + 1})`
      }
      
      fields.push({
        selector,
        tagName,
        type,
        name,
        id,
        placeholder,
        className,
        labelText,
        isVisible: element.offsetParent !== null
      })
    })
    
    return fields
  })
  
  // Log found fields
  formFields.forEach((field, index) => {
    console.log(`📍 Field ${index + 1}: ${field.name || field.id || 'unnamed'} (${field.type}) - Label: "${field.labelText}" - Selector: ${field.selector}`)
  })
  
  return formFields
}

function matchLabelsToSelectors(geminiInstructions: any[], formFields: FormField[]): MatchedInstruction[] {
  console.log('🔗 Matching Gemini labels to Playwright selectors...')
  
  const matched: MatchedInstruction[] = []
  
  for (const instruction of geminiInstructions) {
    const { fieldDescription, action, value, labelText, confidence, reasoning } = instruction
    
    // Try to find matching form field
    const matchingField = findMatchingField(labelText, formFields)
    
    if (matchingField) {
      matched.push({
        ...instruction,
        selector: matchingField.selector,
        matchedField: matchingField,
        matchConfidence: calculateMatchConfidence(labelText, matchingField.labelText)
      })
      console.log(`✅ Matched "${labelText}" → ${matchingField.selector} (${matchingField.labelText})`)
    } else {
      console.log(`❌ No match found for "${labelText}"`)
    }
  }
  
  return matched
}

function findMatchingField(geminiLabel: string, formFields: FormField[]): FormField | null {
  const normalizedGeminiLabel = normalizeLabel(geminiLabel)
  
  // Try exact match first
  for (const field of formFields) {
    if (normalizeLabel(field.labelText) === normalizedGeminiLabel) {
      return field
    }
  }
  
  // Try partial match
  for (const field of formFields) {
    if (normalizeLabel(field.labelText).includes(normalizedGeminiLabel) || 
        normalizedGeminiLabel.includes(normalizeLabel(field.labelText))) {
      return field
    }
  }
  
  // Try keyword matching
  const geminiKeywords = extractKeywords(normalizedGeminiLabel)
  for (const field of formFields) {
    const fieldKeywords = extractKeywords(normalizeLabel(field.labelText))
    if (hasCommonKeywords(geminiKeywords, fieldKeywords)) {
      return field
    }
  }
  
  return null
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\*\s*$/, '') // Remove trailing asterisks
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim()
}

function extractKeywords(label: string): string[] {
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
  return label
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
}

function hasCommonKeywords(keywords1: string[], keywords2: string[]): boolean {
  return keywords1.some(k1 => keywords2.some(k2 => k1.includes(k2) || k2.includes(k1)))
}

function calculateMatchConfidence(geminiLabel: string, fieldLabel: string): number {
  const normalizedGemini = normalizeLabel(geminiLabel)
  const normalizedField = normalizeLabel(fieldLabel)
  
  if (normalizedGemini === normalizedField) return 1.0
  if (normalizedGemini.includes(normalizedField) || normalizedField.includes(normalizedGemini)) return 0.8
  
  const geminiKeywords = extractKeywords(normalizedGemini)
  const fieldKeywords = extractKeywords(normalizedField)
  const commonKeywords = geminiKeywords.filter(k1 => fieldKeywords.some(k2 => k1.includes(k2) || k2.includes(k1)))
  
  return commonKeywords.length / Math.max(geminiKeywords.length, fieldKeywords.length)
}

// Types
interface FormField {
  selector: string
  tagName: string
  type: string
  name: string
  id: string
  placeholder: string
  className: string
  labelText: string
  isVisible: boolean
}

interface MatchedInstruction {
  fieldDescription: string
  action: string
  value: string
  labelText: string
  confidence: number
  reasoning: string
  selector: string
  matchedField: FormField
  matchConfidence: number
}