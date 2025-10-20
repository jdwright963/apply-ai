import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Debug function to list available models
export async function listAvailableModels() {
  try {
    const { models } = await genAI.listModels()
    console.log('Available Gemini models:')
    for (const model of models) {
      console.log(`- ${model.name}`)
      if (model.supportedGenerationMethods) {
        console.log(`  Supported methods: ${model.supportedGenerationMethods.join(', ')}`)
      }
    }
    return models
  } catch (error) {
    console.error('Error listing models:', error)
    return []
  }
}

export const ResumeDataSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  portfolio: z.string().url().optional(),
  summary: z.string().optional(),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    responsibilities: z.array(z.string()).optional(),
  })).optional(),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    gpa: z.string().optional(),
  })).optional(),
  skills: z.array(z.string()).optional(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    url: z.string().url().optional(),
  })).optional(),
  awards: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
}).partial() // Make all top-level fields optional for robustness

export interface CoverLetterResult {
  coverLetter: string
  fitScore: number
  tone: 'friendly' | 'formal'
}

export async function generateCoverLetter(
  resumeText: string,
  jobDescription: string,
  jobTitle: string,
  company: string
): Promise<CoverLetterResult> {
  const basePrompt = `Based on this resume and job description, write a professional and natural-sounding cover letter.

RESUME:
${resumeText}

JOB POSTING:
Title: ${jobTitle}
Company: ${company}
Description: ${jobDescription}

IMPORTANT: Make this cover letter sound natural and conversational, as if written by a thoughtful person, not an AI. Avoid generic phrases like "I am excited to apply" or "I believe I would be a great fit." Instead, use specific details from the resume and job description to create a genuine, personalized connection. Write as if you're having a conversation with the hiring manager.

Output JSON with the following structure:
{
  "coverLetter": "The complete cover letter text",
  "fitScore": 85,
  "tone": "friendly"
}

The fitScore should be a number from 0-100 representing how well the candidate matches the job requirements.
The tone should be either "friendly" or "formal" based on what would be most appropriate for this role.`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    const result = await model.generateContent(basePrompt)
    const response = await result.response
    const text = response.text()

    console.log('Raw Gemini response:', text)

    // Clean up the response text to extract JSON
    let jsonText = text.trim()
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    // Try to find JSON object in the text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    console.log('Cleaned JSON text:', jsonText)

    // Parse the JSON response
    const resultData = JSON.parse(jsonText) as CoverLetterResult
    
    // Validate the response
    if (!resultData.coverLetter || typeof resultData.fitScore !== 'number' || !resultData.tone) {
      throw new Error('Invalid response format from Gemini')
    }

    // Ensure fitScore is within bounds
    resultData.fitScore = Math.max(0, Math.min(100, resultData.fitScore))

    return resultData
  } catch (error) {
    console.error('Error generating cover letter:', error)
    throw new Error('Failed to generate cover letter')
  }
}

export type ResumeData = z.infer<typeof ResumeDataSchema>

export interface StructuredParseResult {
  success: boolean
  data?: ResumeData
  error?: string
}

export async function parseResumeStructured(resumeText: string): Promise<StructuredParseResult> {
  const prompt = `
    You are an expert resume parser. Your task is to extract structured information from the provided resume text.
    Output the extracted data as a JSON object strictly adhering to the following TypeScript interface.
    If a field is not found, omit it or set it to null. Ensure all URLs are valid.

    interface ResumeData {
      name?: string;
      email?: string;
      phone?: string;
      linkedin?: string; // URL
      github?: string; // URL
      portfolio?: string; // URL
      summary?: string;
      experience?: Array<{
        title: string;
        company: string;
        location?: string;
        startDate: string; // e.g., "Month Year" or "Year"
        endDate?: string; // e.g., "Month Year", "Year", or "Present"
        description?: string;
        responsibilities?: string[];
      }>;
      education?: Array<{
        degree: string;
        institution: string;
        location?: string;
        startDate?: string; // e.g., "Month Year" or "Year"
        endDate?: string; // e.g., "Month Year" or "Year"
        gpa?: string;
      }>;
      skills?: string[];
      projects?: Array<{
        name: string;
        description?: string;
        url?: string; // URL
      }>;
      awards?: string[];
      certifications?: string[];
      languages?: string[];
    }

    ---
    Resume Text:
    ${resumeText}
    ---
    JSON Output:
  `

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Clean up the response text to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsedResponse = JSON.parse(jsonMatch[0]) as ResumeData
    return { success: true, data: parsedResponse }
  } catch (error) {
    console.error('Error calling Gemini API for structured resume parsing:', error)
    return { success: false, error: `Failed to parse resume structured data: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}
