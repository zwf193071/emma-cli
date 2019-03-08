const chalk = require('chalk')
const EventEmitter = require('events')
const path = require('path')
const debug = require('debug')
const semver = require('semver')
// const execa = require('execa')
const cloneDeep = require('lodash.clonedeep')
const inquirer = require('inquirer')
const Generator = require('./Generator')
const writeFileTree = require('./writeFileTree')
const {
  hasYarn,
  logWithSpinner,
  installDeps,
  stopSpinner,
  log,
  loadModule,
  sortObject,
  getVersions
} = require('../utils')

const {
  defaults,
  saveOptions,
  loadOptions,
  savePreset,
  validatePreset
} = require('./options')

const isManualMode = answers => answers.preset === '__manual__'

module.exports = class Creator extends EventEmitter {
  constructor (name, context) {
    super()

    this.name = name
    this.context = process.env.VUE_CLI_CONTEXT = context
    const { presetPrompt, featurePrompt } = this.resolveIntroPrompts()
    this.presetPrompt = presetPrompt
    this.featurePrompt = featurePrompt
    this.outroPrompts = this.resolveOutroPrompts()
    this.injectedPrompts = []
    this.promptCompleteCbs = []
    this.createCompleteCbs = []
  }

  async create (cliOptions = {}, preset = null) {
    const { name, context } = this
    if (!preset) {
      preset = await this.promptAndResolvePreset()
    }
    // clone before mutating
    preset = cloneDeep(preset)
    // inject core service
    preset.plugins['@vue/cli-service'] = Object.assign({
      projectName: name
    }, preset, {
      bare: cliOptions.bare
    })
    const packageManager = (
      cliOptions.packageManager ||
      loadOptions().packageManager ||
      (hasYarn() ? 'yarn' : 'npm')
    )
    // await clearConsole()
    logWithSpinner(`✨`, `Creating project in ${chalk.yellow(context)}.`)
    // this.emit('creation', { event: 'creating' })
    
    // get latest CLI version
    const { latest } = await getVersions()
    const latestMinor = `${semver.major(latest)}.${semver.minor(latest)}.0`

    const pkg = {
      name,
      version: '0.0.1',
      private: true,
      devDependencies: {}
    }
    const deps = Object.keys(preset.plugins)
    deps.forEach(dep => {
      if (preset.plugins[dep]._isPreset) {
        return
      }
      pkg.devDependencies[dep] = (
        preset.plugins[dep].version ||
        ((/^@vue/.test(dep)) ? `^${latestMinor}` : `latest`)
      )
    })
    // write package.json
    await writeFileTree(context, {
      'package.json': JSON.stringify(pkg, null, 2)
    })
    // install plugins
    stopSpinner()
    log(`⚙  Installing CLI plugins. This might take a while...`)
    log()
    // this.emit('creation', { event: 'plugins-install' })
    await installDeps(context, packageManager, cliOptions.registry)

    log(`🚀  Invoking generators...`)

    const plugins = await this.resolvePlugins(preset.plugins)
    debug('plugins:1')(plugins)
    const generator = new Generator(context, {
      pkg,
      plugins,
      // completeCbs: createCompleteCbs
    })
    await generator.generate({
      extractConfigFiles: preset.useConfigFiles
    })
  }

  getPresets () {
    const savedOptions = loadOptions()
    return Object.assign({}, savedOptions.presets, defaults.presets)
  }
  async promptAndResolvePreset (answers = null) {
    if (!answers) {
      answers = await inquirer.prompt(this.resolveFinalPrompts())
    }
    if (answers.packageManager) {
      saveOptions({
        packageManager: answers.packageManager
      })
    }
    let preset
    if (answers.preset && answers.preset !== '__manual__') {
      preset = await this.resolvePreset(answers.preset)
    }
    // validate
    validatePreset(preset)
    // save preset
    if (answers.save && answers.saveName) {
      savePreset(answers.saveName, preset)
    }
    return preset
  }
  async resolvePreset (name, clone) {
    let preset
    const savedPresets = loadOptions().presets || {}
    // use default preset if user has not overwritten it
    if (name === 'default' && !preset) {
      preset = defaults.presets.default
    }
    if (!preset) {
      error(`preset "${name}" not found.`)
      const presets = Object.keys(savedPresets)
      if (presets.length) {
        log()
        log(`available presets:\n${presets.join(`\n`)}`)
      } else {
        log(`you don't seem to have any saved preset.`)
        log(`run vue-cli in manual mode to create a preset.`)
      }
      exit(1)
    }
    return preset
  }
  async resolvePlugins (rawPlugins) {
    // ensure cli-service is invoked first
    rawPlugins = sortObject(rawPlugins, ['@vue/cli-service'], true)
    const plugins = []
    for (const id of Object.keys(rawPlugins)) {
      const apply = loadModule(`${id}/generator`, this.context) || (() => {})
      let options = rawPlugins[id] || {}
      if (options.prompts) {
        const prompts = loadModule(`${id}/prompts`, this.context)
        if (prompts) {
          log()
          log(`${chalk.cyan(options._isPreset ? `Preset options:` : id)}`)
          options = await inquirer.prompt(prompts)
        }
      }
      plugins.push({ id, apply, options })
    }
    return plugins
  }
  resolveIntroPrompts () {
    const presets = this.getPresets()
    const presetChoices = Object.keys(presets).map(name => {
      return {
        name: name,
        value: name
      }
    })
    const presetPrompt = {
      name: 'preset',
      type: 'list',
      message: `Please pick a preset:`,
      choices: [
        ...presetChoices,
        {
          name: 'Manually select features',
          value: '__manual__'
        }
      ]
    }
    const featurePrompt = {
      name: 'features',
      when: isManualMode,
      type: 'checkbox',
      message: 'Check the features needed for your project:',
      choices: [],
      pageSize: 10
    }
    return {
      presetPrompt,
      featurePrompt
    }
  }
  resolveFinalPrompts () {
    // patch generator-injected prompts to only show in manual mode
    this.injectedPrompts.forEach(prompt => {
      const originalWhen = prompt.when || (() => true)
      prompt.when = answers => {
        return isManualMode(answers) && originalWhen(answers)
      }
    })
    const prompts = [
      this.presetPrompt,
      this.featurePrompt,
      ...this.injectedPrompts,
      ...this.outroPrompts
    ]
    return prompts
  }
  resolveOutroPrompts () {
    const outroPrompts = [
      {
        name: 'useConfigFiles',
        when: isManualMode,
        type: 'list',
        message: 'Where do you prefer placing config for Babel, PostCSS, ESLint, etc.?',
        choices: [
          {
            name: 'In dedicated config files',
            value: 'files'
          },
          {
            name: 'In package.json',
            value: 'pkg'
          }
        ]
      },
      {
        name: 'save',
        when: isManualMode,
        type: 'confirm',
        message: 'Save this as a preset for future projects?',
        default: false
      },
      {
        name: 'saveName',
        when: answers => answers.save,
        type: 'input',
        message: 'Save preset as:'
      }
    ]

    // ask for packageManager once
    const savedOptions = loadOptions()
    if (!savedOptions.packageManager && hasYarn()) {
      outroPrompts.push({
        name: 'packageManager',
        type: 'list',
        message: 'Pick the package manager to use when installing dependencies:',
        choices: [
          {
            name: 'Use Yarn',
            value: 'yarn',
            short: 'Yarn'
          },
          {
            name: 'Use NPM',
            value: 'npm',
            short: 'NPM'
          }
        ]
      })
    }

    return outroPrompts
  }
}
