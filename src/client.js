const hash = require('hash-sum')
const { isJS } = require('./util')

// const debug = (file, obj) => {
//   require('fs').writeFileSync(__dirname + '/' + file, JSON.stringify(obj, null, 2))
// }

module.exports = class VueSSRClientPlugin {
  constructor (options = {}) {
    this.options = Object.assign({
      filename: 'vue-ssr-client-manifest.json',
    }, options)
  }

  apply (compiler) {
    compiler.plugin('emit', (compilation, cb) => {
      const stats = compilation.getStats().toJson()

      const allFiles = stats.assets
        .map(a => a.name)

      const initialScripts = Object.keys(stats.entrypoints)
        .map(name => stats.entrypoints[name].assets)
        .reduce((assets, all) => all.concat(assets), [])
        .filter(isJS)

      const asyncScripts = allFiles
        .filter(isJS)
        .filter(file => initialScripts.indexOf(file) < 0)

      const manifest = {
        publicPath: stats.publicPath,
        all: allFiles,
        initial: initialScripts,
        async: asyncScripts,
        modules: { /* [identifier: string]: Array<index: number> */ }
      }

      const assetModules = stats.modules.filter(m => m.assets.length)
      const fileToIndex = file => manifest.all.indexOf(file)
      stats.modules.forEach(m => {
        // ignore modules duplicated in multiple chunks
        if (m.chunks.length === 1) {
          const cid = m.chunks[0]
          const chunk = stats.chunks.find(c => c.id === cid)
          const files = manifest.modules[hash(m.identifier)] = chunk.files.map(fileToIndex)
          // find all asset modules associated with the same chunk
          assetModules.forEach(m => {
            if (m.chunks.some(id => id === cid)) {
              files.push.apply(files, m.assets.map(fileToIndex))
            }
          })
        }
      })

      // debug('stats.json', stats)
      // debug('client-manifest.json', manifest)

      const json = JSON.stringify(manifest, null, 2)
      compilation.assets[this.options.filename] = {
        source: () => json,
        size: () => json.length
      }
      cb()
    })
  }
}
