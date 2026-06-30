import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const platform = readArg('--platform') ?? process.platform
const arch = readArg('--arch') ?? process.arch
const sourceDir = path.join(root, 'vendor', 'mpv', platform, arch)
const targetDir = path.join(root, 'resources', 'native', platform, arch)

if (!fs.existsSync(sourceDir)) {
  fail([
    `Missing vendored mpv runtime directory: ${path.relative(root, sourceDir)}`,
    'Put the release-reviewed libmpv runtime under vendor/mpv/<platform>/<arch> first.',
    'This script never copies from system PATH, Homebrew, apt, winget, or user-installed players.',
  ].join('\n'))
}

assertRuntimeShape(sourceDir)
await fs.promises.rm(targetDir, { recursive: true, force: true })
await fs.promises.mkdir(path.dirname(targetDir), { recursive: true })
await fs.promises.cp(sourceDir, targetDir, { recursive: true })
await restoreExecutableBits(targetDir)

console.warn(`[native] staged ${path.relative(root, sourceDir)} -> ${path.relative(root, targetDir)}`)

/**
 * @param {string} dir
 * @returns {void}
 */
function assertRuntimeShape(dir) {
  if (platform === 'darwin') {
    requireFile(dir, 'libmpv.2.dylib')
    return
  }
  if (platform === 'win32') {
    requireOneOf(dir, ['libmpv.dll', 'mpv-2.dll', 'libmpv-2.dll'])
    requireFile(dir, path.join('include', 'mpv', 'client.h'))
    requireFile(dir, path.join('include', 'mpv', 'render.h'))
    requireFile(dir, path.join('include', 'mpv', 'render_gl.h'))
    return
  }
  if (platform === 'linux') {
    requireFile(dir, 'libmpv.so')
    return
  }
  fail(`Unsupported native platform: ${platform}`)
}

/**
 * @param {string} dir
 * @param {string} relativePath
 * @returns {void}
 */
function requireFile(dir, relativePath) {
  const target = path.join(dir, relativePath)
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    fail(`Missing required native artifact: ${path.relative(root, target)}`)
  }
}

/**
 * @param {string} dir
 * @param {string[]} names
 * @returns {void}
 */
function requireOneOf(dir, names) {
  const found = names.find((name) => fs.existsSync(path.join(dir, name)))
  if (!found) fail(`Missing required native artifact. Expected one of: ${names.join(', ')}`)
}

/**
 * @param {string} dir
 * @returns {Promise<void>}
 */
async function restoreExecutableBits(dir) {
  if (platform === 'win32') return
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await restoreExecutableBits(target)
      return
    }
    if (entry.name === 'mpv' || entry.name.endsWith('.dylib') || entry.name.includes('.so')) {
      await fs.promises.chmod(target, 0o755)
    }
  }))
}

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function readArg(name) {
  const prefix = `${name}=`
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`[native] ${message}`)
  process.exit(1)
}
