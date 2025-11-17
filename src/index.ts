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

  program
    .command('list')
    .alias('ls')
    .description('List installed packages')
    .action(async () => {
      await ensureAuthenticated()
      const { getIPM } = await import('./ipm.js')
      const ipm = getIPM()

      try {
        logger.info('Fetching installed packages...')
        const packages = await ipm.getInstalled()

        if (packages.length === 0) {
          logger.info('No packages installed.')
          return
        }

        logger.info(`\nInstalled packages (${packages.length}):\n`)
        for (const pkg of packages) {
          logger.info(
            `  ${pkg.name}@${pkg.version}${pkg.description ? ` - ${pkg.description}` : ''}`
          )
        }
      } catch (error) {
        logger.error('Failed to fetch installed packages:', error)
        process.exit(1)
      }
    })

  program
    .command('outdated')
    .description('List outdated packages')
    .action(async () => {
      await ensureAuthenticated()
      const { getIPM } = await import('./ipm.js')
      const ipm = getIPM()

      try {
        logger.info('Checking for outdated packages...')
        const outdated = await ipm.getOutdated()

        if (outdated.length === 0) {
          logger.info('All packages are up to date.')
          return
        }

        logger.info(`\nOutdated packages (${outdated.length}):\n`)
        for (const pkg of outdated) {
          logger.info(`  ${pkg.name}: ${pkg.version} → ${pkg.latestVersion}`)
        }
      } catch (error) {
        logger.error('Failed to check outdated packages:', error)
        process.exit(1)
      }
    })

  program
    .command('install <package>')
    .description('Install a package')
    .option('-v, --version <version>', 'Specific version to install')
    .action(async (packageName: string, options: { version?: string }) => {
      await ensureAuthenticated()
      const { getIPM } = await import('./ipm.js')
      const ipm = getIPM()

      try {
        const versionStr = options.version ? `@${options.version}` : ''
        logger.info(`Installing ${packageName}${versionStr}...`)
        await ipm.install(packageName, options.version)
        logger.info(`✓ Successfully installed ${packageName}${versionStr}`)
      } catch (error) {
        logger.error(`Failed to install ${packageName}:`, error)
        process.exit(1)
      }
    })

  program
    .command('update <package>')
    .description('Update a package')
    .option('-v, --version <version>', 'Specific version to update to')
    .action(async (packageName: string, options: { version?: string }) => {
      await ensureAuthenticated()
      const { getIPM } = await import('./ipm.js')
      const ipm = getIPM()

      try {
        const versionStr = options.version ? `@${options.version}` : ''
        logger.info(`Updating ${packageName}${versionStr}...`)
        await ipm.update(packageName, options.version)
        logger.info(`✓ Successfully updated ${packageName}${versionStr}`)
      } catch (error) {
        logger.error(`Failed to update ${packageName}:`, error)
        process.exit(1)
      }
    })

  program
    .command('uninstall <package>')
    .alias('remove')
    .description('Uninstall a package')
    .action(async (packageName: string) => {
      await ensureAuthenticated()
      const { getIPM } = await import('./ipm.js')
      const ipm = getIPM()

      try {
        logger.info(`Uninstalling ${packageName}...`)
        const result = await ipm.uninstall(packageName)
        if (result) {
          logger.info(`✓ Successfully uninstalled ${packageName}`)
        } else {
          logger.warn(`Package ${packageName} was not installed`)
        }
      } catch (error) {
        logger.error(`Failed to uninstall ${packageName}:`, error)
        process.exit(1)
      }
    })

  program
    .command('search <query>')
    .description('Search for packages')
    .option(
      '-s, --sort <sort>',
      'Sort order (score, majority, recency, newness)'
    )
    .option('-d, --direction <direction>', 'Sort direction (asc, desc)')
    .action(
      async (query: string, options: { sort?: string; direction?: string }) => {
        await ensureAuthenticated()
        const { getIPM } = await import('./ipm.js')
        const ipm = getIPM()

        try {
          logger.info(`Searching for "${query}"...`)
          const results = await ipm.registry.search({
            q: query,
            sort: options.sort as any,
            direction: options.direction
          })

          if (results.length === 0) {
            logger.info('No packages found.')
            return
          }

          logger.info(`\nFound ${results.length} package(s):\n`)
          for (const pkg of results) {
            logger.info(`  ${pkg.name} (v${pkg.releases.latest})`)
            if (pkg.metadata.description) {
              logger.info(`    ${pkg.metadata.description}`)
            }
            logger.info(`    Downloads: ${pkg.downloads}`)
            logger.info('')
          }
        } catch (error) {
          logger.error('Search failed:', error)
          process.exit(1)
        }
      }
    )

  program
    .command('info <package>')
    .description('Show package information')
    .action(async (packageName: string) => {
      await ensureAuthenticated()
      const { getIPM } = await import('./ipm.js')
      const ipm = getIPM()

      try {
        logger.info(`Fetching information for ${packageName}...`)
        const info = await ipm.registry.getPackageInfo(packageName)

        logger.info(`\nPackage: ${info.name}`)
        logger.info(`Latest version: ${info.releases.latest}`)
        if (info.metadata.description) {
          logger.info(`Description: ${info.metadata.description}`)
        }
        if (info.repository) {
          logger.info(`Repository: ${info.repository}`)
        }
        if (info.metadata.license) {
          logger.info(`License: ${info.metadata.license}`)
        }
        logger.info(`Downloads: ${info.downloads}`)
        if (info.metadata.keywords && info.metadata.keywords.length > 0) {
          logger.info(`Keywords: ${info.metadata.keywords.join(', ')}`)
        }
        if (info.metadata.engines?.inkdrop) {
          logger.info(`Inkdrop version: ${info.metadata.engines.inkdrop}`)
        }
      } catch (error) {
        logger.error(`Failed to fetch package info:`, error)
        process.exit(1)
      }
    })

  await program.parseAsync(process.argv)
}
