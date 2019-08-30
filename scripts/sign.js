'use strict'

require('shelljs/make')

const { check, say } = require('./util')('sign')
const { join, resolve, relative } = require('path')
const { qualified } = require('../lib/common/release')
const { arch, platform } = process
const dir = resolve(__dirname, '..')

const KITS = 'C:\\Program Files (x86)\\Windows Kits\\'

target.all = (...args) => {
  target[platform](...args)
}

target.linux = () => {
  say('skipping linux code-signing...')
}

target.win32 = (args = []) => {
  if (args[0] === 'force') {
    check(platform === 'win32', 'must be run on Windows')

    let [, cert, pass] = args
    cert = cert || env.SIGN_WIN32_CERT
    pass = pass || env.SIGN_WIN32_PASS

    check(pass, 'missing password')
    check(cert, 'missing certificate')
    check(test('-f', cert), `certificate not found: ${cert}`)

    const signtool = getSignTool()
    const params = getSignToolParams(cert, pass)
    check(signtool, `missing dependency: ${signtool}`)

    const targets = ls('-d', join(dir, 'dist', '*-win32-*'))
    check(targets.length, 'no targets found')

    for (let target of targets) {
      for (let file of ls(join(target, '*.exe'))) {
        exec(`"${signtool}" sign ${params} "${file}"`)
        exec(`"${signtool}" verify /pa "${file}"`)
      }
    }
  } else {
    say('win32 code-signing not forced, skipping...')
  }
}

target.darwin = (args = []) => {
  check(platform === 'darwin', 'must be run on macOS')

  let codesign = which('codesign')
  let spctl = which('spctl')

  check(codesign, 'missing dependency: codesign')
  check(spctl, 'missing dependency: spctl')

  let targets = ls('-d', join(dir, 'dist', '*-darwin-*'))
  let identity = args[0] || env.SIGN_DARWIN_IDENTITY
  let entitlements = join(dir, 'res', 'darwin', 'entitlements.plist')

  check(targets.length, 'no targets found')
  check(identity, 'missing identity')

  let app
  let cnt

  for (let target of targets) {
    app = join(target, `${qualified.product}.app`)
    cnt = join(app, 'Contents')
    check(test('-d', app), `app not found: ${app}`)

    // Clear temporary files from previous signing
    for (let file of find(`"${app}" -name "*.cstemp" -type f`)) {
      if (file) rm(file)
    }

    say(`signing ${relative(dir, app)} with ${identity}...`)

    for (let file of find(`"${join(cnt, 'Resources')}" -perm +111 -type f`)) {
      sign(file)
    }

    for (let file of find(`"${join(cnt, 'Frameworks')}" -perm +111 -type f`)) {
      sign(file)
    }

    for (let file of find(`"${cnt}" -name "*.app" -type d`)) {
      sign(file)
    }

    for (let file of find(`"${cnt}" -name "*.framework" -type d`)) {
      sign(file)
    }

    for (let file of find(`"${join(cnt, 'MacOS')}" -perm +111 -type f`)) {
      sign(file)
    }


    sign(app)
    verify(app)
  }

  let options = [
    `--sign ${identity}`,
    '--options runtime',
    '--force',
    '--verbose',
    `--entitlements ${entitlements}`
  ].join(' ')

  function sign(file) {
    say(`${relative(app, file)}`)
    exec(`${codesign} ${options} "${file}"`, { silent: true })
  }

  function verify(file) {
    say(`verify ${relative(app, file)}`)
    exec(`${codesign} --verify --deep --display --verbose=2 "${file}"`)
    exec(`${spctl} --ignore-cache --no-cache --assess -t execute --v "${file}"`)
  }
}

function find(args) {
  return exec(`find ${args}`, { silent: true }).stdout.trim().split('\n')
}


function getSignTool() {
  return [
    join(KITS, '8.1', 'bin', arch, 'signtool.exe'),
    join(KITS, '10', 'bin', arch, 'signtool.exe')
  ].find(signtool => test('-f', signtool))
}

function getSignToolParams(cert, pass) {
  return [
    '/fd SHA256', `/f ${cert}`, `/p "${pass}"`
  ].join(' ')
}

module.exports = {
  getSignTool,
  getSignToolParams
}
