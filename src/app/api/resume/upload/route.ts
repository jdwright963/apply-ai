import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import mammoth from 'mammoth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('resume') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be < 10MB' }, { status: 400 })
  }

  const fileName = file.name || 'resume'
  const ext = fileName.split('.').pop()?.toLowerCase()

  let text = ''

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (ext === 'pdf') {
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
  } else if (ext === 'docx') {
    const parsed = await mammoth.extractRawText({ buffer })
    text = parsed.value
  } else {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  text = text.replace(/\s+/g, ' ').trim()

  await db.user.update({
    where: { email: session.user.email },
    data: { resumeText: text },
  })

  return NextResponse.json({ success: true, textLength: text.length })
}


