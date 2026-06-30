import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = process.cwd()
const platform = process.platform
const arch = process.arch
const nativeDir = path.join(root, 'resources', 'native', platform, arch)
const libmpvPath = path.join(nativeDir, platform === 'darwin' ? 'libmpv.2.dylib' : 'libmpv.so')
const addonPath = path.join(nativeDir, 'ehp_mpv_player.node')

if (!fs.existsSync(libmpvPath)) {
  fail([
    `Missing bundled libmpv runtime: ${path.relative(root, libmpvPath)}`,
    'This app must use libmpv embedding and must not spawn a player executable.',
    'Run bundle:native:mac with a reviewed libmpv.dylib artifact.',
  ].join('\n'))
}

const stat = fs.statSync(libmpvPath)
if (!stat.isFile()) {
  fail(`Bundled libmpv path is not a file: ${path.relative(root, libmpvPath)}`)
}

if (platform === 'darwin') {
  if (!fs.existsSync(addonPath)) {
    fail(`Missing MPV host view addon: ${path.relative(root, addonPath)}`)
  }
  if (!fs.statSync(addonPath).isFile()) {
    fail(`libmpv player addon path is not a file: ${path.relative(root, addonPath)}`)
  }
  assertNoForbiddenRuntimeRefs()
  assertNoProcessMpvBackend()
}

console.warn(`[native] bundled libmpv ok: ${path.relative(root, libmpvPath)}`)
if (platform === 'darwin') {
  console.warn(`[native] libmpv player addon ok: ${path.relative(root, addonPath)}`)
}

function assertNoForbiddenRuntimeRefs() {
  const files = fs.readdirSync(nativeDir).filter((name) => name.endsWith('.dylib') || name.endsWith('.node'))
  for (const file of files) {
    const target = path.join(nativeDir, file)
    const output = execOtool(target)
    if (output.includes('/opt/homebrew/') || output.includes('/usr/local/')) {
      fail(`Native artifact has non-bundled dylib reference: ${path.relative(root, target)}`)
    }
  }
}

function assertNoProcessMpvBackend() {
  const files = [
    path.join(root, 'electron', 'main'),
    path.join(root, 'src'),
    path.join(root, 'scripts'),
  ]
  const forbidden = [
    `--${'wid'}`,
    `force-${'window'}`,
    `EHP_${'MPV'}_BINARY_PATH`,
  ]
  const self = path.resolve(fileURLToPath(import.meta.url))
  for (const file of walk(files)) {
    if (path.resolve(file) === self) continue
    const text = fs.readFileSync(file, 'utf8')
    const hit = forbidden.find((pattern) => text.includes(pattern))
    if (hit) fail(`Forbidden process-mpv marker "${hit}" found in ${path.relative(root, file)}`)
    if (text.includes(`spawn${'('}`) && text.includes('mpv')) {
      fail(`Forbidden mpv process spawn found in ${path.relative(root, file)}`)
    }
  }
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
function walk(paths) {
  /** @type {string[]} */
  const result = []
  for (const item of paths) {
    if (!fs.existsSync(item)) continue
    const stat = fs.statSync(item)
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(item)) result.push(...walk([path.join(item, child)]))
    } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.mjs')) {
      result.push(item)
    }
  }
  return result
}

/**
 * @param {string} file
 * @returns {string}
 */
function execOtool(file) {
  return execFileSync('otool', ['-L', file], { encoding: 'utf8' })
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`[native] ${message}`)
  process.exit(1)
}
