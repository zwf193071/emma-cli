#!/usr/bin/env node

const download = require('download-git-repo')
const fs = require('fs-extra')
const exists = require('fs').existsSync
const path = require('path')
const chalk = require('chalk')
const inquirer = require('inquirer')
const debug = require('debug')
const Metalsmith = require('metalsmith')
const {
  error,
  logWithSpinner,
  stopSpinner
} = require('../utils')

const isLocalPath = (templatePath) => {
  return /^[./]|(^[a-zA-Z]:)/.test(templatePath)
}
async function create (template, projectName, options) {
  const cwd = options.cwd || process.cwd()
  const inCurrent = projectName === '.'
  const name = inCurrent ? path.relative('../', cwd) : projectName
  const targetDir = path.resolve(cwd, projectName || '.')
  const templatePath = path.isAbsolute(template) ? template : path.normalize(path.join(process.cwd(), template))
  const to = path.resolve(projectName || '.')
  const tmp = path.join(process.cwd(), template.replace(/[\/:]/g, '-'))
  if (fs.existsSync(targetDir)) {
    if (options.force) {
      await fs.remove(targetDir)
    } else {
      if (inCurrent) {
        const { ok } = await inquirer.prompt([
          {
            name: 'ok',
            type: 'confirm',
            message: `Generate project in current directory?`
          }
        ])
        if (!ok) {
          return
        }
      } else {
        const { action } = await inquirer.prompt([
          {
            name: 'action',
            type: 'list',
            message: `Target directory ${chalk.cyan(targetDir)} already exists. Pick an action:`,
            choices: [
              { name: 'Overwrite', value: 'overwrite' },
              { name: 'Merge', value: 'merge' },
              { name: 'Cancel', value: false }
            ]
          }
        ])
        if (!action) {
          return
        } else if (action === 'overwrite') {
          console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
          await fs.remove(targetDir)
        }
      }
    }
  }

  if (isLocalPath(template)) {
    if (exists(templatePath)) {
      generate(name, templatePath, to, err => {
        if (err) {
          error(err)
          return
        }
        console.log(chalk.cyan(`✔ Create the project ${chalk.yellow(name)} successfully\n`))
      })
    } else {
      error(`Local template "${template}" not found.`)
    }
  } else {
    const officialTemplate = 'zwf193071/' + template
    debug('template:a')(officialTemplate)
    logWithSpinner(`✨`, `Creating project in ${chalk.yellow(targetDir)}.`)
    download(officialTemplate, tmp, {clone: true}, err => {
      stopSpinner()
      debug('template:b')(tmp)
      if (err) {
        error(`Failed to download repo '${template}': ${err.message.trim()}`)
        return
      }
      debug('template:c')(111)
      generate(name, tmp, to, err => {
        if (err) {
          error(err)
          return
        }
        console.log(chalk.cyan(`✔ Create the project ${chalk.yellow(name)} successfully\n`))
      })
    })
  }
  
}

function generate (name, src, dest, done) {
  const metalsmith = Metalsmith(src)
  const data = Object.assign(metalsmith.metadata(), {
    destDirName: name,
    inPlace: dest === process.cwd(),
    noEscape: true
  })
  metalsmith.clean(false)
    .source('.') // start from template root instead of `./src` which is Metalsmith's default for `source`
    .destination(dest)
    .build((err) => {
      done(err)
    })

  return data
}

module.exports = (...args) => {
  return create(...args).catch(err => {
    stopSpinner(false) // do not persist
    error(err)
  })
}
