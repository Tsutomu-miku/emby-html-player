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

if (platform !== 'darwin') {
  fail('libmpv player addon is currently implemented for macOS only')
}

await fs.promises.mkdir(outputDir, { recursive: true })
run(process.execPath, [findNodeGyp(), 'rebuild'], addonDir)
if (!fs.existsSync(sourceAddon)) {
  fail(`node-gyp did not produce ${path.relative(root, sourceAddon)}`)
}
await fs.promises.copyFile(sourceAddon, targetAddon)
await fs.promises.chmod(targetAddon, 0o755)
run('install_name_tool', ['-change', '/opt/homebrew/opt/mpv/lib/libmpv.2.dylib', '@loader_path/libmpv.2.dylib', targetAddon], root)
run('install_name_tool', ['-change', '/opt/homebrew/Cellar/mpv/0.41.0_6/lib/libmpv.2.dylib', '@loader_path/libmpv.2.dylib', targetAddon], root)
run('codesign', ['--force', '--sign', '-', targetAddon], root)
console.warn(`[native] built libmpv player addon: ${path.relative(root, targetAddon)}`)

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
