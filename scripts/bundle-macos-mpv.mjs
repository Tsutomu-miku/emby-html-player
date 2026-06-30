import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = readRequiredArg('--source')
const arch = readArg('--arch') ?? process.arch
const targetDir = path.join(root, 'resources', 'native', 'darwin', arch)
/** @type {Map<string, string>} */
const copiedByOriginal = new Map()
/** @type {Map<string, string>} */
const originalByLocal = new Map()

if (process.platform !== 'darwin') {
  fail('bundle-macos-mpv.mjs must run on macOS')
}
if (!fs.existsSync(source)) {
  fail(`libmpv source dylib does not exist: ${source}`)
}

await fs.promises.mkdir(targetDir, { recursive: true })
await removePreviousRuntimeArtifacts(targetDir)

const localLibMpv = path.join(targetDir, 'libmpv.2.dylib')
await fs.promises.copyFile(source, localLibMpv)
await fs.promises.chmod(localLibMpv, 0o755)
originalByLocal.set(localLibMpv, fs.realpathSync(source))

/** @type {string[]} */
const queue = [localLibMpv]
for (let index = 0; index < queue.length; index++) {
  const localFile = queue[index]
  const originalFile = originalByLocal.get(localFile) ?? localFile
  const deps = readMachDeps(localFile)
  if (isDylib(localFile) && deps[0]) {
    run('install_name_tool', ['-id', `@loader_path/${path.basename(localFile)}`, localFile])
  }
  const dependencyNames = isDylib(localFile) ? deps.slice(1) : deps
  for (const dep of dependencyNames) {
    if (!isBundlableDependency(dep)) continue
    const copied = await copyDependency(dep)
    run('install_name_tool', [
      '-change',
      dep,
      `@loader_path/${path.basename(copied)}`,
      localFile,
    ])
    if (!queue.includes(copied)) queue.push(copied)
  }
  console.warn(`[native] bundled deps for ${path.relative(root, localFile)} from ${originalFile}`)
}

for (const file of queue) {
  adHocSign(file)
}

console.warn(`[native] macOS libmpv runtime bundled at ${path.relative(root, targetDir)}`)

/**
 * @param {string} dep
 * @returns {Promise<string>}
 */
async function copyDependency(dep) {
  const original = fs.realpathSync(dep)
  const existing = copiedByOriginal.get(original)
  if (existing) return existing
  const local = path.join(targetDir, path.basename(dep))
  if (fs.existsSync(local)) {
    const current = originalByLocal.get(local)
    if (current && current !== original) {
      fail(`Dependency basename collision: ${dep} conflicts with ${current}`)
    }
  } else {
    await fs.promises.copyFile(original, local)
    await fs.promises.chmod(local, 0o755)
  }
  copiedByOriginal.set(original, local)
  originalByLocal.set(local, original)
  return local
}

/**
 * @param {string} dir
 * @returns {Promise<void>}
 */
async function removePreviousRuntimeArtifacts(dir) {
  const entries = await fs.promises.readdir(dir)
  await Promise.all(entries.map((entry) => removeRuntimeArtifact(path.join(dir, entry), entry)))
}

/**
 * @param {string} file
 * @param {string} name
 * @returns {Promise<void>}
 */
async function removeRuntimeArtifact(file, name) {
  if (name.endsWith('.dylib') || name === 'mpv' || name === 'mpv.exe') {
    await fs.promises.rm(file, { recursive: true, force: true })
  }
}

/**
 * @param {string} file
 * @returns {string[]}
 */
function readMachDeps(file) {
  const output = execFileSync('otool', ['-L', file], { encoding: 'utf8' })
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((value) => value && value !== ':')
}

/**
 * @param {string} dep
 * @returns {boolean}
 */
function isBundlableDependency(dep) {
  if (dep.startsWith('/System/Library/')) return false
  if (dep.startsWith('/usr/lib/')) return false
  if (dep.startsWith('@loader_path/')) return false
  if (dep.startsWith('@executable_path/')) return false
  if (dep.startsWith('@rpath/')) return false
  return dep.startsWith('/opt/homebrew/') || dep.startsWith('/usr/local/')
}

/**
 * @param {string} file
 * @returns {boolean}
 */
function isDylib(file) {
  return path.basename(file).includes('.dylib')
}

/**
 * @param {string} file
 * @returns {void}
 */
function adHocSign(file) {
  run('codesign', ['--force', '--sign', '-', file])
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {void}
 */
function run(command, args) {
  execFileSync(command, args, { stdio: 'pipe' })
}

/**
 * @param {string} name
 * @returns {string}
 */
function readRequiredArg(name) {
  const value = readArg(name)
  if (!value) fail(`Missing required argument ${name}=...`)
  return path.resolve(root, value)
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
