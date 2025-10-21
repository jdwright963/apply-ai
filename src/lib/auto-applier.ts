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
    
    console.log('📝 Filling form fields with screenshot-based instructions...')
    await fillFormWithInstructions(page, analysisResult.instructions, options)
    
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

async function fillFormWithInstructions(page: Page, instructions: any[], options: AutoApplyOptions) {
  console.log('🎯 Filling form with screenshot-based instructions...')
  
  for (const instruction of instructions) {
    try {
      const { fieldDescription, action, value, selector, confidence, reasoning } = instruction
      
      if (!value || value.trim() === '' || value === 'N/A') {
        console.log(`⏭️ Skipping empty field: ${fieldDescription}`)
        continue
      }
      
      if (confidence < 0.5) {
        console.log(`⚠️ Low confidence (${Math.round(confidence * 100)}%) for ${fieldDescription}: ${reasoning}`)
        continue
      }
      
      if (action === 'fill') {
        // Fill text input
        if (selector) {
          const element = await page.locator(selector).first()
          const isVisible = await element.isVisible()
          
          if (isVisible) {
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
        } else {
          console.log(`⚠️ No selector provided for ${fieldDescription}`)
        }
        
      } else if (action === 'click') {
        // Click radio button or checkbox
        if (selector) {
          const element = await page.locator(selector).first()
          const isVisible = await element.isVisible()
          
          if (isVisible) {
            await element.click()
            console.log(`✅ Clicked ${fieldDescription} (${Math.round(confidence * 100)}%): ${value}`)
            console.log(`   Reasoning: ${reasoning}`)
          } else {
            console.log(`❌ Field not visible: ${fieldDescription} (${selector})`)
          }
        } else {
          console.log(`⚠️ No selector provided for ${fieldDescription}`)
        }
        
      } else if (action === 'select') {
        // Select dropdown option
        if (selector) {
          const element = await page.locator(selector).first()
          const isVisible = await element.isVisible()
          
          if (isVisible) {
            await element.selectOption(value)
            console.log(`✅ Selected ${fieldDescription} (${Math.round(confidence * 100)}%): ${value}`)
            console.log(`   Reasoning: ${reasoning}`)
          } else {
            console.log(`❌ Field not visible: ${fieldDescription} (${selector})`)
          }
        } else {
          console.log(`⚠️ No selector provided for ${fieldDescription}`)
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