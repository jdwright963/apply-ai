// Cleanup function for Playwright browser
export async function cleanupJobScraper() {
  if (scraperInstance) {
    await scraperInstance.close()
    scraperInstance = null
  }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  await cleanupJobScraper()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanupJobScraper()
  process.exit(0)
})

