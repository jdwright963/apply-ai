import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

export interface FieldMapping {
  fieldSelector: string
  fieldLabel: string
  fieldType: string
  mappedValue: string
  confidence: number
  reasoning: string
}

export interface FieldMappingResult {
  success: boolean
  mappings: FieldMapping[]
  error?: string
}

export interface FormFillInstruction {
  fieldDescription: string
  action: 'fill' | 'click' | 'select'
  value: string
  selector: string
  reasoning: string
  confidence: number
}

export interface FormAnalysisResult {
  success: boolean
  instructions: FormFillInstruction[]
  error?: string
}

export async function analyzeFormScreenshots(
  screenshots: Buffer[],
  resumeText: string,
  jobDescription: string,
  formFields: any[],
  userPreferences?: any,
  coverLetter?: string
): Promise<FormAnalysisResult> {
  const prompt = `You are an expert at analyzing job application forms and matching resume data to form fields.

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

USER PREFERENCES:
${userPreferences ? JSON.stringify(userPreferences, null, 2) : 'No user preferences provided'}

COVER LETTER:
${coverLetter || 'No cover letter provided'}

AVAILABLE FORM FIELDS AND THEIR SELECTORS:
${JSON.stringify(formFields, null, 2)}

TASK: Look at these screenshot(s) of a job application form and tell me exactly how to fill out each field using the EXACT SELECTORS provided above.

IMPORTANT RULES:
1. **Use Exact Selectors**: You MUST use the exact CSS selectors from the formFields data above
2. **Be Specific**: Use exact values from the resume (names, dates, numbers, etc.)
3. **Use User Preferences**: For common questions (gender, race, salary, work authorization, etc.), use the user's preferred values
4. **Match Field Types**: 
   - Text inputs: Fill with appropriate text
   - Radio buttons: Click the correct option
   - Checkboxes: Check relevant boxes
   - Dropdowns: Select the best option
5. **Handle Complex Fields**:
   - Salary: Use user's salary expectations or realistic ranges based on experience level
   - Years of experience: Calculate from resume dates
   - Skills: Select relevant technologies from resume
   - Location: Use user's current location or "Remote" if applicable
   - Work authorization: Use user's preference
   - Gender/Race: Use user's preferences (respect privacy choices)
6. **Cover Letter Field**: Look for cover letter text areas and provide instructions to fill them with the provided cover letter
7. **Be Conservative**: Only fill fields you're confident about
8. **Format Appropriately**: Use proper formats for dates, phone numbers, etc.

For each field you want to fill, provide:
- fieldDescription: What the field is asking for
- action: "fill" for text inputs, "click" for radio/checkbox, "select" for dropdowns
- value: The exact value to enter or option to select
- selector: The EXACT CSS selector from the formFields data above
- reasoning: Why this value is appropriate
- confidence: 0-1 confidence score

SPECIAL INSTRUCTIONS:
- If you see a cover letter text area, provide instructions to fill it with the provided cover letter
- For demographic questions (gender, race, veteran status, disability), use user preferences
- For work authorization, use the user's preference
- For salary expectations, use the user's specified amount or range
- For location fields, use the user's current location

Output JSON with this structure:
{
  "instructions": [
    {
      "fieldDescription": "Full Name text input",
      "action": "fill",
      "value": "John Wright",
      "selector": "input[name=\"cName\"]",
      "reasoning": "Extracted full name from resume header",
      "confidence": 0.95
    },
    {
      "fieldDescription": "Cover Letter textarea",
      "action": "fill",
      "value": "[COVER_LETTER_FROM_DATABASE]",
      "selector": "textarea[name=\"cCoverLetter\"]",
      "reasoning": "Fill with the generated cover letter from the database",
      "confidence": 0.9
    },
    {
      "fieldDescription": "Work authorization radio buttons",
      "action": "click", 
      "value": "Yes",
      "selector": "input[name=\"section_1747256596389_question_1\"]",
      "reasoning": "User preference indicates authorized to work in US",
      "confidence": 0.9
    }
  ]
}`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    // Convert screenshots to base64 for Gemini Vision
    const imageParts = screenshots.map(screenshot => ({
      inlineData: {
        data: screenshot.toString('base64'),
        mimeType: 'image/png'
      }
    }))
    
    const result = await model.generateContent([prompt, ...imageParts])
    const response = await result.response
    const text = response.text()

    console.log('Raw Gemini Vision response:', text)

    // Clean up the response text to extract JSON
    let jsonText = text.trim()
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    // Extract JSON object using regex
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    if (!parsed.instructions || !Array.isArray(parsed.instructions)) {
      throw new Error('Invalid response format: missing instructions array')
    }

    return {
      success: true,
      instructions: parsed.instructions
    }

  } catch (error) {
    console.error('Error analyzing form screenshots:', error)
    return {
      success: false,
      instructions: [],
      error: error instanceof Error ? error.message : 'Failed to analyze form screenshots'
    }
  }
}

export async function generateFieldMappings(
  resumeText: string,
  formFields: any[],
  jobDescription: string
): Promise<FieldMappingResult> {
  const prompt = `You are an expert at matching resume data to job application form fields. 

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

FORM FIELDS:
${JSON.stringify(formFields, null, 2)}

TASK: For each form field, determine the best value from the resume data to fill it with. Be intelligent about matching:

1. **Name fields**: Extract full name, first name, last name appropriately
2. **Contact fields**: Use email, phone, address from resume
3. **Experience fields**: Format work experience appropriately for the field type
4. **Education fields**: Format education details appropriately
5. **Skills fields**: List relevant skills, possibly filtered by job requirements
6. **Cover letter fields**: Generate a personalized cover letter
7. **Date fields**: Format dates properly (MM/YYYY, YYYY-MM-DD, etc.)
8. **Number fields**: Extract years of experience, salary expectations, etc.
9. **Select/Radio fields**: Choose the most appropriate option from available choices

IMPORTANT RULES:
- Always use specific, accurate data from the resume
- Format values appropriately for each field type
- For select/radio fields, choose the closest matching option
- For text areas, provide comprehensive but concise information
- For cover letters, make them personalized and job-specific
- If no relevant data exists, leave the field empty or use "N/A"
- Be conservative - only fill fields you're confident about

Output JSON with this structure:
{
  "mappings": [
    {
      "fieldSelector": "#full-name",
      "fieldLabel": "Full Name",
      "fieldType": "text",
      "mappedValue": "John Wright",
      "confidence": 0.95,
      "reasoning": "Extracted full name from resume header"
    }
  ]
}

The confidence should be 0-1, where 1 is completely confident.`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    console.log('Raw Gemini field mapping response:', text)

    // Clean up the response text to extract JSON
    let jsonText = text.trim()
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    // Extract JSON object using regex
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
      throw new Error('Invalid response format: missing mappings array')
    }

    return {
      success: true,
      mappings: parsed.mappings
    }

  } catch (error) {
    console.error('Error generating field mappings:', error)
    return {
      success: false,
      mappings: [],
      error: error instanceof Error ? error.message : 'Failed to generate field mappings'
    }
  }
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
