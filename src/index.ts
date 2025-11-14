import { Command } from 'commander'
import { getAccessToken, openAccessKeyPage, saveAccessToken } from './auth.js'
import { prompt } from './input.js'
import { logger } from './logger.js'

/**
 * Configure the CLI tool by authenticating with the Inkdrop service
 */
async function configure() {
  logger.info('Configuring Inkdrop CLI...\n')

  // Check if already authenticated
  const existingToken = getAccessToken()
  if (existingToken) {
    logger.info('✓ You are already authenticated.')
    const answer = await prompt(
      'Do you want to reconfigure with a new access token? (y/N): '
    )
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      logger.info('Configuration cancelled.')
      return
    }
  }

  // Open the desktop app to display the access key
  logger.info('Opening Inkdrop desktop app to display your access key...')
  await openAccessKeyPage()

  // Prompt for the access token
  const token = await prompt(
    '\nPlease paste your access token from the desktop app: '
  )

  if (!token) {
    logger.error('Error: Access token cannot be empty.')
    process.exit(1)
  }

  // Save the token
  try {
    saveAccessToken(token)
    logger.info('\n✓ Access token saved successfully!')
    logger.info('You can now use the Inkdrop CLI.')
  } catch (error) {
    logger.error('Error saving access token:', error)
    process.exit(1)
  }
}

/**
 * Check if the user is authenticated and prompt to configure if not
 */
export async function ensureAuthenticated() {
  const token = getAccessToken()
  if (!token) {
    logger.info('You are not authenticated yet.')
    await configure()
  }
  return getAccessToken()
}

export async function main() {
  const program = new Command()

  program
    .name('ipm')
    .description('Inkdrop Plugin Manager - Manage your Inkdrop plugins')
    .version('0.1.0')

  program
    .command('configure')
    .description('Configure the CLI by setting up authentication')
    .action(async () => {
      await configure()
    })

  // Add other commands here as needed
  // Example:
  // program
  //   .command('install <plugin>')
  //   .description('Install a plugin')
  //   .action(async (plugin) => {
  //     await ensureAuthenticated()
  //     // Install logic here
  //   })

  await program.parseAsync(process.argv)
}
