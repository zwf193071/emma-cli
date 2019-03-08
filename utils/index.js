[
    'env',
    'loadCommand',
    'logger',
    'spinner',
    'validate',
    'exit',
    'rcPath',
    'request',
    'installDeps',
    'module',
    'normalizeFilePaths',
    'injectImportsAndOptions',
    'sortObject',
    'getVersions',
    'pluginResolution',
    'mergeDeps',
    'extendJSConfig',
    'stringifyJS'
  ].forEach(m => {
    Object.assign(exports, require(`./lib/${m}`))
  })