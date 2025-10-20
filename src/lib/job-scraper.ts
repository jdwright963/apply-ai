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
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      
      // Navigate to the job posting
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      
      // Wait for content to load
      await page.waitForTimeout(2000)
      
      // Get the page content
      const content = await page.content()
      
      await page.close()
      
      // Parse with Cheerio
      const $ = cheerio.load(content)
      
      // Extract job data based on common patterns
      const jobData = this.extractJobData($, url)
      
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

  private extractJobData($: cheerio.CheerioAPI, url: string): JobPostingData {
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

    // Extract title
    let title = this.extractText($, selectors.title) || 'Unknown Title'
    
    // Extract company
    let company = this.extractText($, selectors.company) || this.extractCompanyFromUrl(url)
    
    // Extract description
    let description = this.extractText($, selectors.description) || this.extractFallbackDescription($)
    
    // Extract location
    const location = this.extractText($, selectors.location)
    
    // Extract salary
    const salary = this.extractText($, selectors.salary)
    
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

  private extractText($: cheerio.CheerioAPI, selectors: string[]): string | null {
    for (const selector of selectors) {
      const element = $(selector).first()
      if (element.length > 0) {
        const text = element.text().trim()
        if (text) {
          return text
        }
      }
    }
    return null
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

  private extractFallbackDescription($: cheerio.CheerioAPI): string {
    // Try to find any substantial text content
    const textSelectors = [
      'main',
      '.main-content',
      '.content',
      'article',
      '.job-content',
      'body'
    ]
    
    for (const selector of textSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        const text = element.text().trim()
        if (text.length > 100) { // Only return if substantial content
          return text
        }
      }
    }
    
    return 'Job description not found'
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

