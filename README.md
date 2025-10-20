# Apply AI - AI Job Application Assistant

A comprehensive Next.js application that automates job applications using AI, structured resume parsing, and browser automation.

## 🚀 Features

### Core Functionality
- **Magic Link Authentication** - Secure email-based login (no passwords)
- **Resume Upload & Parsing** - Supports PDF and DOCX formats
- **Job Scraping** - Automatically extracts job details from URLs
- **AI Cover Letter Generation** - Personalized cover letters using OpenAI
- **Application Tracking** - Database-backed application management

### 🤖 Auto-Application Features (NEW!)
- **Structured Resume Parsing** - Extracts name, email, phone, experience, skills, education
- **Form Field Detection** - Automatically detects application form fields
- **Browser Automation** - Uses Playwright to fill and submit forms
- **Application Preview** - Review applications before submission
- **Smart Field Mapping** - Maps resume data to form fields intelligently
- **Error Handling** - Comprehensive error handling and retry logic

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: tRPC, Prisma, PostgreSQL
- **Authentication**: NextAuth.js with magic links
- **AI**: OpenAI GPT-4 for cover letter generation and resume parsing
- **Browser Automation**: Playwright
- **Email**: Resend SDK
- **UI Components**: shadcn/ui

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key
- Resend API key

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd apply-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/apply_ai"

   # NextAuth
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"

   # Email (Resend)
   RESEND_API_KEY="your-resend-api-key"
   EMAIL_FROM="noreply@yourdomain.com"

   # OpenAI
   OPENAI_API_KEY="your-openai-api-key"
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

## 🎯 Usage

### Basic Workflow
1. **Sign In** - Enter your email to receive a magic link
2. **Upload Resume** - Upload your PDF or DOCX resume
3. **Add Job URLs** - Paste job posting URLs
4. **Generate Applications** - Let the AI scrape job details and create applications

### Auto-Application Workflow
1. **Upload Resume** - The system parses your resume into structured data
2. **Add Job URLs** - Paste job application URLs
3. **Click "Auto Apply"** - Opens the application preview modal
4. **Detect Form Fields** - Automatically detects form fields on the job site
5. **Review Application** - Preview the filled form before submission
6. **Submit Application** - Automatically fills and submits the application

## 🔧 API Endpoints

### Resume Management
- `POST /api/resume/upload` - Upload and parse resume files
- `api.resume.get` - Get resume data and settings
- `api.resume.updateHumanifyMode` - Update AI humanization settings

### Application Management
- `api.application.getAll` - Get all applications
- `api.application.analyzeJobPosting` - Scrape job posting details
- `api.application.generateCoverLetter` - Generate AI cover letter
- `api.application.detectFormFields` - Detect form fields on job sites
- `api.application.autoApply` - Automatically apply to jobs
- `api.application.updateSubmissionStatus` - Update application status

## 🗄 Database Schema

### User Model
```prisma
model User {
  id            String         @id @default(cuid())
  name          String?
  email         String         @unique
  emailVerified DateTime?
  image         String?
  resumeText    String?        // Raw resume text
  resumeData    Json?          // Structured resume data
  humanifyMode  Boolean        @default(true)
  accounts      Account[]
  sessions      Session[]
  applications  Application[]
}
```

### Application Model
```prisma
model Application {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  url             String
  company         String?
  title           String?
  description     String?  @db.Text
  location        String?
  salary          String?
  requirements    String[]
  responsibilities String[]
  coverLetter     String?  @db.Text
  status          String   @default("Pending")
  fitScore        Float?
  appliedAt       DateTime @default(now())
  scrapedAt       DateTime @default(now())
  
  // Auto-application fields
  autoApplyEnabled Boolean  @default(false)
  formData         Json?    // Detected form fields
  applicationPreview Json?  // Preview before submission
  submittedAt      DateTime?
  submissionStatus String?  // "pending", "submitted", "failed"
  submissionError  String?  @db.Text
}
```

## 🤖 AI Features

### Resume Parsing
The system uses OpenAI GPT-4 to parse resumes into structured data:
- Personal information (name, email, phone, location)
- Professional summary
- Work experience with achievements
- Education details
- Skills and certifications
- Projects and portfolio links

### Cover Letter Generation
AI-generated cover letters that:
- Match your resume to job requirements
- Use natural, conversational tone (configurable)
- Avoid generic phrases
- Include specific achievements and skills

### Form Field Detection
Intelligent form field detection that:
- Identifies common field types (name, email, phone, etc.)
- Calculates confidence scores
- Maps resume data to appropriate fields
- Handles various form layouts and naming conventions

## 🔒 Security Features

- **Magic Link Authentication** - No passwords stored
- **Session Management** - Secure session handling
- **User Isolation** - Users can only access their own data
- **Input Validation** - Comprehensive input validation with Zod
- **Error Handling** - Secure error handling without data leakage

## 🚀 Deployment

### Environment Setup
1. Set up PostgreSQL database
2. Configure environment variables
3. Install Playwright browsers on server
4. Set up Resend email service
5. Configure OpenAI API access

### Production Considerations
- Set `headless: true` in Playwright configuration
- Configure proper CORS settings
- Set up monitoring and logging
- Implement rate limiting for API calls
- Set up backup strategies for database

## 🐛 Troubleshooting

### Common Issues

1. **Resume Upload Fails**
   - Check file format (PDF/DOCX only)
   - Verify file size (< 10MB)
   - Check OpenAI API key

2. **Form Detection Issues**
   - Ensure job site is accessible
   - Check for anti-bot measures
   - Verify Playwright installation

3. **Auto-Application Fails**
   - Check browser automation settings
   - Verify form field detection
   - Review error logs

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

## 📈 Future Enhancements

- [ ] Multi-language support
- [ ] Advanced form field detection
- [ ] Application tracking integrations
- [ ] Resume optimization suggestions
- [ ] Interview scheduling automation
- [ ] Salary negotiation assistance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ using Next.js, tRPC, Prisma, and OpenAI**