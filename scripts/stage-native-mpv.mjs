import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const platform = readArg('--platform') ?? process.platform
const arch = readArg('--arch') ?? process.arch
const binaryName = platform === 'win32' ? 'mpv.exe' : 'mpv'
const sourceDir = path.join(root, 'vendor', 'mpv', platform, arch)
const targetDir = path.join(root, 'resources', 'native', platform, arch)
const sourceBinary = path.join(sourceDir, binaryName)

if (!fs.existsSync(sourceBinary)) {
  fail([
    `Missing vendored mpv artifact: ${path.relative(root, sourceBinary)}`,
    'Put the release-reviewed mpv runtime under vendor/mpv/<platform>/<arch> first.',
    'This script never copies from system PATH, Homebrew, apt, winget, or user-installed players.',
  ].join('\n'))
}

await fs.promises.rm(targetDir, { recursive: true, force: true })
await fs.promises.mkdir(path.dirname(targetDir), { recursive: true })
await fs.promises.cp(sourceDir, targetDir, { recursive: true })

const targetBinary = path.join(targetDir, binaryName)
if (platform !== 'win32') {
  await fs.promises.chmod(targetBinary, 0o755)
}

console.warn(`[native] staged ${path.relative(root, sourceDir)} -> ${path.relative(root, targetDir)}`)

function readArg(name) {
  const prefix = `${name}=`
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function fail(message) {
  console.error(`[native] ${message}`)
  process.exit(1)
}
