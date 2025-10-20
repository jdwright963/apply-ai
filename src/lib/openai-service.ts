import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface CoverLetterResult {
  coverLetter: string
  fitScore: number
  tone: 'friendly' | 'formal'
}

export async function generateCoverLetter(
  resumeText: string,
  jobDescription: string,
  jobTitle: string,
  company: string,
  humanifyMode: boolean = true
): Promise<CoverLetterResult> {
  const basePrompt = `Based on this resume and job description, write a professional and natural-sounding cover letter.

RESUME:
${resumeText}

JOB POSTING:
Title: ${jobTitle}
Company: ${company}
Description: ${jobDescription}

${humanifyMode ? `
IMPORTANT: Make this cover letter sound natural and conversational, as if written by a thoughtful person, not an AI. Avoid generic phrases like "I am excited to apply" or "I believe I would be a great fit." Instead, use specific details from the resume and job description to create a genuine, personalized connection. Write as if you're having a conversation with the hiring manager.` : ''}

Output JSON with the following structure:
{
  "coverLetter": "The complete cover letter text",
  "fitScore": 85,
  "tone": "friendly"
}

The fitScore should be a number from 0-100 representing how well the candidate matches the job requirements.
The tone should be either "friendly" or "formal" based on what would be most appropriate for this role.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach and cover letter writer. You write compelling, personalized cover letters that help candidates stand out.'
        },
        {
          role: 'user',
          content: basePrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response
    const result = JSON.parse(responseText) as CoverLetterResult
    
    // Validate the response
    if (!result.coverLetter || typeof result.fitScore !== 'number' || !result.tone) {
      throw new Error('Invalid response format from OpenAI')
    }

    // Ensure fitScore is within bounds
    result.fitScore = Math.max(0, Math.min(100, result.fitScore))

    return result
  } catch (error) {
    console.error('Error generating cover letter:', error)
    throw new Error('Failed to generate cover letter')
  }
}

