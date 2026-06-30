import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const platform = process.platform
const arch = process.arch
const addonDir = path.join(root, 'native', 'mpv-player')
const outputDir = path.join(root, 'resources', 'native', platform, arch)
const sourceAddon = path.join(addonDir, 'build', 'Release', 'ehp_mpv_player.node')
const targetAddon = path.join(outputDir, 'ehp_mpv_player.node')

if (!['darwin', 'win32'].includes(platform)) {
  fail(`libmpv native addon is not implemented for ${platform}/${arch} yet`)
}

await fs.promises.mkdir(outputDir, { recursive: true })
if (platform === 'win32') ensureWindowsRuntimeReady()

runNodeGyp()
if (!fs.existsSync(sourceAddon)) {
  fail(`node-gyp did not produce ${path.relative(root, sourceAddon)}`)
}
await fs.promises.copyFile(sourceAddon, targetAddon)
if (platform !== 'win32') await fs.promises.chmod(targetAddon, 0o755)

if (platform === 'darwin') {
  rewriteMacDylibRefs(targetAddon)
  run('codesign', ['--force', '--sign', '-', targetAddon], root)
}

console.warn(`[native] built libmpv player addon: ${path.relative(root, targetAddon)}`)

function runNodeGyp() {
  const args = [findNodeGyp(), 'rebuild']
  const env = { ...process.env }
  if (platform === 'win32') {
    const includeDir = resolveWindowsMpvIncludeDir()
    env.GYP_DEFINES = [env.GYP_DEFINES, `mpv_include_dir="${includeDir}"`]
      .filter(Boolean)
      .join(' ')
  }
  execFileSync(process.execPath, args, { cwd: addonDir, env, stdio: 'inherit' })
}

function ensureWindowsRuntimeReady() {
  const dll = findWindowsLibMpvDll(outputDir)
  if (!dll) {
    fail([
      `Missing Windows libmpv runtime in ${path.relative(root, outputDir)}`,
      'Expected one of: libmpv.dll, mpv-2.dll, libmpv-2.dll.',
      'Stage a reviewed runtime with: pnpm stage:native -- --platform=win32 --arch=x64',
    ].join('\n'))
  }
  resolveWindowsMpvIncludeDir()
}

function resolveWindowsMpvIncludeDir() {
  const configured = readArg('--mpv-include-dir') ?? process.env['MPV_INCLUDE_DIR']
  const candidates = [
    configured,
    path.join(root, 'vendor', 'mpv', platform, arch, 'include'),
    path.join(outputDir, 'include'),
  ].filter(Boolean)
  const found = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'mpv', 'client.h')) &&
    fs.existsSync(path.join(candidate, 'mpv', 'render.h')) &&
    fs.existsSync(path.join(candidate, 'mpv', 'render_gl.h')),
  )
  if (!found) {
    fail([
      'Missing Windows libmpv headers.',
      'Expected mpv/client.h, mpv/render.h, and mpv/render_gl.h in one of:',
      ...candidates.map((candidate) => `- ${path.relative(root, candidate)}`),
    ].join('\n'))
  }
  return found
}

/**
 * @param {string} dir
 * @returns {string | undefined}
 */
function findWindowsLibMpvDll(dir) {
  return ['libmpv.dll', 'mpv-2.dll', 'libmpv-2.dll']
    .map((name) => path.join(dir, name))
    .find((candidate) => fs.existsSync(candidate))
}

/**
 * @param {string} addonPath
 * @returns {void}
 */
function rewriteMacDylibRefs(addonPath) {
  run('install_name_tool', ['-change', '/opt/homebrew/opt/mpv/lib/libmpv.2.dylib', '@loader_path/libmpv.2.dylib', addonPath], root)
  run('install_name_tool', ['-change', '/opt/homebrew/Cellar/mpv/0.41.0_6/lib/libmpv.2.dylib', '@loader_path/libmpv.2.dylib', addonPath], root)
}

/**
 * @returns {string}
 */
function findNodeGyp() {
  const candidates = [
    path.join(root, 'node_modules', '.pnpm', 'node-gyp@12.4.0', 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'),
    path.join(root, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) fail('node-gyp is not installed in node_modules')
  return found
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
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {void}
 */
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`[native] ${message}`)
  process.exit(1)
}
