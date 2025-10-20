import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import mammoth from 'mammoth'
import { parseResumeStructured } from '@/lib/gemini-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('resume') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a PDF or DOCX file.' }, { status: 400 })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let text = ''

    if (file.type === 'application/pdf') {
      const PDFParser = require('pdf2json')
      const pdfParser = new PDFParser()
      
      const parsed = await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', reject)
        pdfParser.on('pdfParser_dataReady', resolve)
        pdfParser.parseBuffer(buffer)
      })
      
      // Extract text from all pages
      text = parsed.Pages.map((page: any) => 
        page.Texts.map((text: any) => 
          text.R.map((r: any) => decodeURIComponent(r.T)).join('')
        ).join(' ')
      ).join('\n')
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const parsed = await mammoth.extractRawText({ buffer })
      text = parsed.value
    }

    text = text.replace(/\s+/g, ' ').trim()

    // Parse resume into structured data using Gemini
    const parseResult = await parseResumeStructured(text)
    
    if (!parseResult.success) {
      console.error('Failed to parse resume:', parseResult.error)
      // Still save the raw text even if structured parsing fails
    }

    // Update user with both raw text and structured data
    await db.user.update({
      where: { id: session.user.id },
      data: { 
        resumeText: text,
        resumeData: parseResult.data || null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      fileName: file.name,
      textLength: text.length,
      structuredData: parseResult.data,
      parseSuccess: parseResult.success,
      parseError: parseResult.error,
    })

  } catch (error) {
    console.error('Error processing resume upload:', error)
    return NextResponse.json(
      { error: `Failed to process resume: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
