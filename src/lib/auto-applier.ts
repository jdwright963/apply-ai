import { chromium, Browser, Page } from 'playwright'
import { ResumeData, generateCoverLetter, analyzeFormScreenshots, FormFillInstruction } from './gemini-service'

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
    
    console.log('📝 Scraping actual form fields...')
    const formStructure = await scrapeFormFields(page)
    console.log(`🔍 Found ${formStructure.questions.length} questions on page`)
    
    console.log('🤖 Analyzing form with Gemini Vision...')
    const analysisResult = await analyzeFormScreenshots(
      screenshots,
      options.resumeText,
      options.jobDescription,
      formStructure,
      options.userPreferences,
      options.coverLetter
    )
    
    if (!analysisResult.success) {
      throw new Error(analysisResult.error || 'Failed to analyze form screenshots')
    }
    
    console.log(`✅ Generated ${analysisResult.instructions.length} fill instructions`)
    
    console.log('📝 Filling form fields with Gemini instructions...')
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

async function fillFormWithInstructions(page: Page, instructions: FormFillInstruction[], options: AutoApplyOptions) {
  console.log('🎯 Filling form with Gemini instructions...')
  
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
async function scrapeFormFields(page: Page): Promise<FormStructure> {
  console.log('🔍 Scraping form fields with hierarchical structure...')
  
  const formStructure = await page.evaluate(() => {
    const questions: any[] = []
    
    // Helper function to find question text for a container
    function findQuestionText(container: HTMLElement): string {
      // Look for headings (h1-h6) in the container
      const heading = container.querySelector('h1, h2, h3, h4, h5, h6')
      if (heading) {
        const headingText = heading.textContent?.trim()
        if (headingText && headingText.length > 0) {
          return headingText
        }
      }
      
      // Look for spans with common question classes
      const questionSpan = container.querySelector('span.ng-binding, span.question-text, span.field-label')
      if (questionSpan) {
        const spanText = questionSpan.textContent?.trim()
        if (spanText && spanText.length > 0) {
          return spanText
        }
      }
      
      // Look for divs with question classes
      const questionDiv = container.querySelector('div.question-title, div.field-title, div.label')
      if (questionDiv) {
        const divText = questionDiv.textContent?.trim()
        if (divText && divText.length > 0) {
          return divText
        }
      }
      
      return ''
    }
    
    // Helper function to find helper text
    function findHelperText(container: HTMLElement): string {
      const helpText = container.querySelector('.question-body, .help-text, .description, .field-description, .form-help')
      if (helpText) {
        const helpTextContent = helpText.textContent?.trim()
        if (helpTextContent && helpTextContent.length > 0) {
          return helpTextContent
        }
      }
      return ''
    }
    
    // Helper function to generate better selectors for grouped inputs
    function generateSelector(input: HTMLElement, questionType: string): string {
      const name = input.getAttribute('name') || ''
      const id = input.getAttribute('id') || ''
      const type = input.getAttribute('type') || 'text'
      const value = input.getAttribute('value') || ''
      
      // For radio buttons, include value in selector
      if (type === 'radio' && value) {
        return `input[name="${name}"][value="${value}"]`
      }
      
      // For checkboxes with same name, use text-based selector
      if (type === 'checkbox' && name) {
        // Find the label text for this checkbox
        const labelElement = input.parentElement?.querySelector('span.ng-binding, label')
        if (labelElement) {
          const labelText = labelElement.textContent?.trim()
          if (labelText) {
            // Use a more specific selector that includes the label text
            return `li.option:has-text("${labelText}") input[type="checkbox"]`
          }
        }
        // Fallback to name + value if available
        if (value) {
          return `input[name="${name}"][value="${value}"]`
        }
        return `input[name="${name}"]`
      }
      
      // For other inputs, use standard selectors
      if (id) {
        return `#${id}`
      } else if (name) {
        return `input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`
      }
      
      return ''
    }
    
    // Find all question containers
    // Look for common patterns: divs with question classes, li.question, etc.
    const questionContainers = document.querySelectorAll(`
      li.question,
      div.question,
      div.field-group,
      div.form-group,
      div.multiplechoice,
      div.singlechoice,
      div.text-question,
      div.checkbox-group,
      div.radio-group
    `)
    
    questionContainers.forEach((container) => {
      const containerElement = container as HTMLElement
      
      // Skip if container is not visible
      if (containerElement.offsetParent === null) return
      
      // Find question text
      const questionText = findQuestionText(containerElement)
      if (!questionText) return
      
      // Find helper text
      const helperText = findHelperText(containerElement)
      
      // Find all inputs in this container
      const inputs = containerElement.querySelectorAll('input, textarea, select')
      if (inputs.length === 0) return
      
      // Determine question type based on input types
      let questionType: string = 'text'
      const inputTypes = Array.from(inputs).map(input => input.getAttribute('type') || 'text')
      
      if (inputTypes.includes('radio')) {
        questionType = 'radio'
      } else if (inputTypes.includes('checkbox')) {
        questionType = 'checkbox'
      } else if (inputTypes.includes('text') || inputTypes.includes('email') || inputTypes.includes('tel')) {
        questionType = 'text'
      } else if (containerElement.querySelector('textarea')) {
        questionType = 'textarea'
      } else if (containerElement.querySelector('select')) {
        questionType = 'select'
      }
      
      // Create fields for this question
      const fields: any[] = []
      
      inputs.forEach((input) => {
        const inputElement = input as HTMLElement
        const type = inputElement.getAttribute('type') || 'text'
        
        // Skip hidden fields
        if (type === 'hidden') return
        
        // Generate selector
        const selector = generateSelector(inputElement, questionType)
        if (!selector) return
        
        // Find label text for this specific input
        let labelText = ''
        
        // For radio/checkbox, get the specific option text
        if (type === 'radio' || type === 'checkbox') {
          const labelElement = inputElement.parentElement?.querySelector('span.ng-binding, label')
          if (labelElement) {
            labelText = labelElement.textContent?.trim() || ''
          }
        } else {
          // For text inputs, use the question text as label
          labelText = questionText
        }
        
        if (labelText) {
          fields.push({
            selector,
            type,
            label: labelText,
            value: inputElement.getAttribute('value') || undefined
          })
        }
      })
      
      if (fields.length > 0) {
        questions.push({
          questionText,
          questionType,
          helperText: helperText || undefined,
          fields
        })
      }
    })
    
    // Handle standalone inputs that weren't captured in question containers
    const allInputs = document.querySelectorAll('input, textarea, select')
    const processedInputs = new Set()
    
    // Mark inputs that were already processed
    questions.forEach((question: any) => {
      question.fields.forEach((field: any) => {
        processedInputs.add(field.selector)
      })
    })
    
    allInputs.forEach((input) => {
      const inputElement = input as HTMLElement
      const type = inputElement.getAttribute('type') || 'text'
      
      if (type === 'hidden') return
      
      const selector = generateSelector(inputElement, type)
      if (processedInputs.has(selector)) return
      
      // Try to find a label for standalone inputs
      let labelText = ''
      const id = inputElement.getAttribute('id')
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`)
        if (label) {
          labelText = label.textContent?.trim() || ''
        }
      }
      
      // Fallback to placeholder or name
      if (!labelText) {
        labelText = inputElement.getAttribute('placeholder') || 
                   inputElement.getAttribute('name') || 
                   'Unnamed field'
      }
      
      if (labelText) {
        questions.push({
          questionText: labelText,
          questionType: type === 'textarea' ? 'textarea' : 'text',
          fields: [{
            selector,
            type,
            label: labelText,
            value: inputElement.getAttribute('value') || undefined
          }]
        })
      }
    })
    
    return { questions }
  })
  
  // Log the hierarchical structure
  formStructure.questions.forEach((question, index) => {
    console.log(`📋 Question ${index + 1}: "${question.questionText}" (${question.questionType})`)
    if (question.helperText) {
      console.log(`   Helper: "${question.helperText}"`)
    }
    question.fields.forEach((field: any, fieldIndex: number) => {
      console.log(`   Field ${fieldIndex + 1}: ${field.label} (${field.type})`)
      console.log(`     Selector: ${field.selector}`)
    })
    console.log('')
  })
  
  return formStructure
}

// Types
interface FormField {
  selector: string
  type: string
  label: string
  value?: string
}

interface FormQuestion {
  questionText: string
  questionType: 'text' | 'radio' | 'checkbox' | 'select' | 'textarea'
  helperText?: string
  fields: FormField[]
}

interface FormStructure {
  questions: FormQuestion[]
}