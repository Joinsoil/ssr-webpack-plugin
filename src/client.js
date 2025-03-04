import hash from 'hash-sum'
import uniq from 'lodash.uniq'

import { isJS, isCSS, onEmit } from './util'

export default class SSRClientPlugin {
  constructor(options = {}) {
    this.options = {
      filename: 'ssr-client-manifest.json',
      ...options,
    }
  }

  apply(compiler) {
    onEmit(compiler, 'ssr-client-plugin', (compilation, cb) => {
      const stats = compilation.getStats().toJson()

      const allFiles = uniq(stats.assets.map(a => a.name))

      const initialFiles = uniq(
        Object.keys(stats.entrypoints)
          .map(name => stats.entrypoints[name].assets)
          .reduce((assets, all) => all.concat(assets), [])
          .filter(file => isJS(file) || isCSS(file))
          .map(function (file) {
            if (typeof file === "string") {
              return file;
            }
  
            if (
              Object.prototype.toString.call(file) === "[object Object]" &&
              file.name
            ) {
              return file.name;
            }
  
            throw new Error(`file structure is not correct: ${file}`);
          }),
      )

      const asyncFiles = allFiles
        .filter(file => isJS(file) || isCSS(file))
        .filter(file => initialFiles.indexOf(file) < 0)

      const manifest = {
        publicPath: stats.publicPath,
        all: allFiles,
        initial: initialFiles,
        async: asyncFiles,
        modules: {
          /* [identifier: string]: Array<index: number> */
        },
      }

      const assetModules = stats.modules.filter(m => m.assets.length)
      const fileToIndex = file => manifest.all.indexOf(file)
      stats.modules.forEach(m => {
        // ignore modules duplicated in multiple chunks
        if (m.chunks.length === 1) {
          const cid = m.chunks[0]
          const chunk = stats.chunks.find(c => c.id === cid)
          if (!chunk || !chunk.files) {
            return
          }
          const id = m.identifier.replace(/\s\w+$/, '') // remove appended hash
          const files = (manifest.modules[hash(id)] = chunk.files.map(
            fileToIndex,
          ))
          // find all asset modules associated with the same chunk
          assetModules.forEach(m => {
            if (m.chunks.some(id => id === cid)) {
              files.push.apply(files, m.assets.map(fileToIndex))
            }
          })
        }
      })

      // const debug = (file, obj) => {
      //   require('fs').writeFileSync(__dirname + '/' + file, JSON.stringify(obj, null, 2))
      // }
      // debug('stats.json', stats)
      // debug('client-manifest.json', manifest)

      const json = JSON.stringify(manifest, null, 2)
      compilation.assets[this.options.filename] = {
        source: () => json,
        size: () => json.length,
      }
      cb()
    })
  }
}
