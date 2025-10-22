import { chromium, Browser, Page } from 'playwright'
import * as cheerio from 'cheerio'

export interface JobPostingData {
  title: string
  company: string
  description: string
  location?: string
  salary?: string
  requirements?: string[]
  responsibilities?: string[]
  url: string
}

export interface ScrapingResult {
  success: boolean
  data?: JobPostingData
  error?: string
}

export class JobScraper {
  private browser: Browser | null = null

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }
  }

  async scrapeJobPosting(url: string): Promise<ScrapingResult> {
    try {
      await this.initialize()
      
      if (!this.browser) {
        throw new Error('Browser not initialized')
      }

      const page = await this.browser.newPage()
      
      // Set longer timeout and more permissive settings
      page.setDefaultTimeout(60000) // 60 seconds
      page.setDefaultNavigationTimeout(60000) // 60 seconds
      
      console.log('Navigating to URL:', url)
      
      // Navigate to the job posting with more permissive settings
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Less strict than 'networkidle'
        timeout: 60000 
      })
      
      console.log('Page loaded, waiting for content...')
      
      // Wait for content to load
      await page.waitForTimeout(3000)
      
      console.log('Getting page content...')
      
      // Get the page content
      const content = await page.content()
      
      await page.close()
      
      console.log('Content retrieved, length:', content.length)
      
      // Parse with Cheerio
      const $ = cheerio.load(content)
      
      // Extract job data based on common patterns
      const jobData = this.extractJobData($, url)
      
      console.log('Job data extracted:', {
        title: jobData.title,
        company: jobData.company,
        descriptionLength: jobData.description.length
      })
      
      return {
        success: true,
        data: jobData
      }
      
    } catch (error) {
      console.error('Error scraping job posting:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private extractJobData($: cheerio.Root, url: string): JobPostingData {
    // First, try to extract from JSON-LD structured data (most reliable)
    const jsonLdData = this.extractFromJsonLd($)
    
    // Common selectors for different job sites
    const selectors = {
      title: [
        'h1[data-testid="job-title"]',
        'h1.job-title',
        'h1[class*="title"]',
        'h1',
        '.job-title',
        '[data-testid="job-title"]',
        'h2[class*="title"]'
      ],
      company: [
        '[data-testid="company-name"]',
        '.company-name',
        '[class*="company"]',
        '.employer-name',
        '[data-testid="employer-name"]'
      ],
      description: [
        '[data-testid="job-description"]',
        '.job-description',
        '.description',
        '[class*="description"]',
        '.job-content',
        '.job-details'
      ],
      location: [
        '[data-testid="job-location"]',
        '.job-location',
        '.location',
        '[class*="location"]'
      ],
      salary: [
        '[data-testid="salary"]',
        '.salary',
        '.compensation',
        '[class*="salary"]',
        '[class*="compensation"]'
      ]
    }

    // Extract title - prioritize JSON-LD, then DOM selectors
    let title = jsonLdData.title || this.extractText($, selectors.title) || 'Unknown Title'
    
    // Extract company - prioritize JSON-LD, then DOM selectors
    let company = jsonLdData.company || this.extractText($, selectors.company) || this.extractCompanyFromUrl(url)
    
    // Extract description - prioritize JSON-LD, then DOM selectors
    let description = jsonLdData.description || this.extractText($, selectors.description) || this.extractFallbackDescription($)
    
    // Extract location - prioritize JSON-LD, then DOM selectors
    const location = jsonLdData.location || this.extractText($, selectors.location)
    
    // Extract salary - prioritize JSON-LD, then DOM selectors
    const salary = jsonLdData.salary || this.extractText($, selectors.salary)
    
    // Clean up the extracted data
    title = this.cleanText(title)
    company = this.cleanText(company)
    description = this.cleanText(description)
    
    // Extract requirements and responsibilities from description
    const requirements = this.extractRequirements(description)
    const responsibilities = this.extractResponsibilities(description)
    
    return {
      title,
      company,
      description,
      location: location ? this.cleanText(location) : undefined,
      salary: salary ? this.cleanText(salary) : undefined,
      requirements,
      responsibilities,
      url
    }
  }

  private extractText($: cheerio.Root, selectors: string[]): string | null {
    for (const selector of selectors) {
      const element = $(selector).first()
      if (element.length > 0) {
        const text = element.text().trim()
        if (text && !this.isCookieContent(text)) {
          return text
        }
      }
    }
    return null
  }

  private isCookieContent(text: string): boolean {
    const lowerText = text.toLowerCase()
    const cookiePhrases = [
      'cookie',
      'consent',
      'accept all cookies',
      'decline all non-necessary cookies',
      'cookie preferences',
      'select which cookies you accept',
      'this website uses cookies',
      'manage cookies',
      'cookie policy'
    ]
    
    return cookiePhrases.some(phrase => lowerText.includes(phrase))
  }

  private extractCompanyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      
      // Remove common prefixes
      const cleanHostname = hostname
        .replace('www.', '')
        .replace('careers.', '')
        .replace('jobs.', '')
        .replace('work.', '')
      
      // Extract company name from domain
      const parts = cleanHostname.split('.')
      if (parts.length > 0) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      }
      
      return 'Unknown Company'
    } catch {
      return 'Unknown Company'
    }
  }

  private extractFromJsonLd($: cheerio.Root): Partial<JobPostingData> {
    const jsonLdData: Partial<JobPostingData> = {}
    
    // Look for JSON-LD script tags
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        let jsonText = $(element).html()
        if (jsonText) {
          // Clean up malformed JSON by removing control characters and fixing common issues
          jsonText = jsonText
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .replace(/\r\n/g, '\\n') // Fix line breaks
            .replace(/\r/g, '\\n') // Fix carriage returns
            .replace(/\n/g, '\\n') // Fix newlines
            .replace(/\t/g, '\\t') // Fix tabs
            .replace(/\\/g, '\\\\') // Escape backslashes
            .replace(/"/g, '\\"') // Escape quotes
          
          const data = JSON.parse(jsonText)
          
          // Handle both single objects and arrays
          const jobPostings = Array.isArray(data) ? data : [data]
          
          for (const jobPosting of jobPostings) {
            if (jobPosting['@type'] === 'JobPosting') {
              // Extract title
              if (jobPosting.title && !jsonLdData.title) {
                jsonLdData.title = jobPosting.title
              }
              
              // Extract company name
              if (jobPosting.hiringOrganization?.name && !jsonLdData.company) {
                jsonLdData.company = jobPosting.hiringOrganization.name
              }
              
              // Extract description
              if (jobPosting.description && !jsonLdData.description) {
                // Clean HTML tags from description
                jsonLdData.description = jobPosting.description
                  .replace(/<[^>]*>/g, '') // Remove HTML tags
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
              }
              
              // Extract location
              if (jobPosting.jobLocation && !jsonLdData.location) {
                if (Array.isArray(jobPosting.jobLocation)) {
                  jsonLdData.location = jobPosting.jobLocation
                    .map((loc: any) => loc.address?.addressLocality || loc.address?.addressCountry || '')
                    .filter(Boolean)
                    .join(', ')
                } else if (jobPosting.jobLocation.address) {
                  const addr = jobPosting.jobLocation.address
                  jsonLdData.location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
                    .filter(Boolean)
                    .join(', ')
                }
              }
              
              // Extract salary
              if (jobPosting.baseSalary && !jsonLdData.salary) {
                const salary = jobPosting.baseSalary
                if (salary.value?.minValue && salary.value?.maxValue) {
                  jsonLdData.salary = `${salary.value.minValue} - ${salary.value.maxValue} ${salary.currency || ''}`
                } else if (salary.value?.value) {
                  jsonLdData.salary = `${salary.value.value} ${salary.currency || ''}`
                }
              }
            }
          }
        }
      } catch (error) {
        console.log('Error parsing JSON-LD, trying alternative approach:', error)
        
        // Try to extract data from the raw text if JSON parsing fails
        try {
          const rawText = $(element).html() || ''
          if (rawText.includes('"@type": "JobPosting"')) {
            // Extract title using regex
            const titleMatch = rawText.match(/"title":\s*"([^"]+)"/)
            if (titleMatch && !jsonLdData.title) {
              jsonLdData.title = titleMatch[1]
            }
            
            // Extract company using regex
            const companyMatch = rawText.match(/"name":\s*"([^"]+)"/)
            if (companyMatch && !jsonLdData.company) {
              jsonLdData.company = companyMatch[1]
            }
          }
        } catch (regexError) {
          console.log('Regex extraction also failed:', regexError)
        }
      }
    })
    
    return jsonLdData
  }

  private extractFallbackDescription($: cheerio.Root): string {
    // Remove cookie banners and overlays first
    this.removeCookieBanners($)
    
    // Try to find any substantial text content
    const textSelectors = [
      'main',
      '.main-content',
      '.content',
      'article',
      '.job-content',
      '.job-description',
      '.description',
      '[class*="job"]',
      '[class*="description"]',
      'body'
    ]
    
    for (const selector of textSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        const text = element.text().trim()
        if (text.length > 200) { // Only return if substantial content
          console.log(`Found content with selector '${selector}', length: ${text.length}`)
          return text
        }
      }
    }
    
    // If no substantial content found, try to get all text from body
    const bodyText = $('body').text().trim()
    if (bodyText.length > 100) {
      console.log(`Using body text as fallback, length: ${bodyText.length}`)
      return bodyText
    }
    
    return 'Job description not found'
  }

  private removeCookieBanners($: cheerio.Root): void {
    // Remove common cookie banner selectors
    const cookieSelectors = [
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
      '[class*="gdpr"]',
      '[id*="gdpr"]',
      '[class*="banner"]',
      '[id*="banner"]',
      '[class*="overlay"]',
      '[id*="overlay"]',
      '[class*="modal"]',
      '[id*="modal"]',
      '[class*="popup"]',
      '[id*="popup"]',
      '[data-testid*="cookie"]',
      '[data-testid*="consent"]',
      '[data-testid*="banner"]',
      '[class*="cookie-banner"]',
      '[class*="cookie-notice"]',
      '[class*="cookie-policy"]',
      '[class*="cookie-accept"]',
      '[class*="cookie-decline"]'
    ]
    
    cookieSelectors.forEach(selector => {
      $(selector).remove()
    })
    
    // Remove elements that contain cookie-related text (more aggressive)
    $('*').each((_, element) => {
      const $el = $(element)
      const text = $el.text().toLowerCase()
      
      // Check for cookie-related phrases
      const cookiePhrases = [
        'cookie',
        'consent',
        'accept all cookies',
        'decline all non-necessary cookies',
        'cookie preferences',
        'select which cookies you accept',
        'this website uses cookies',
        'manage cookies',
        'cookie policy'
      ]
      
      const hasCookieText = cookiePhrases.some(phrase => text.includes(phrase))
      
      if (hasCookieText && text.length < 2000) {
        $el.remove()
      }
    })
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim()
  }

  private extractRequirements(description: string): string[] {
    const requirements: string[] = []
    
    // Look for common requirement patterns
    const requirementPatterns = [
      /requirements?:\s*([^.]*)/gi,
      /qualifications?:\s*([^.]*)/gi,
      /must have:\s*([^.]*)/gi,
      /required:\s*([^.]*)/gi,
      /experience:\s*([^.]*)/gi
    ]
    
    for (const pattern of requirementPatterns) {
      const matches = description.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const requirement = match.replace(/^(requirements?|qualifications?|must have|required|experience):\s*/gi, '').trim()
          if (requirement && requirement.length > 10) {
            requirements.push(requirement)
          }
        })
      }
    }
    
    return requirements.slice(0, 10) // Limit to 10 requirements
  }

  private extractResponsibilities(description: string): string[] {
    const responsibilities: string[] = []
    
    // Look for common responsibility patterns
    const responsibilityPatterns = [
      /responsibilities?:\s*([^.]*)/gi,
      /duties?:\s*([^.]*)/gi,
      /what you'll do:\s*([^.]*)/gi,
      /key responsibilities?:\s*([^.]*)/gi
    ]
    
    for (const pattern of responsibilityPatterns) {
      const matches = description.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const responsibility = match.replace(/^(responsibilities?|duties?|what you'll do|key responsibilities?):\s*/gi, '').trim()
          if (responsibility && responsibility.length > 10) {
            responsibilities.push(responsibility)
          }
        })
      }
    }
    
    return responsibilities.slice(0, 10) // Limit to 10 responsibilities
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

// Singleton instance
let scraperInstance: JobScraper | null = null

export async function getJobScraper(): Promise<JobScraper> {
  if (!scraperInstance) {
    scraperInstance = new JobScraper()
    await scraperInstance.initialize()
  }
  return scraperInstance
}

export async function scrapeJobPosting(url: string): Promise<ScrapingResult> {
  const scraper = await getJobScraper()
  return await scraper.scrapeJobPosting(url)
}

