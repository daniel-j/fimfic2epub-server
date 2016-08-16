'use strict'

const FimFic2Epub = require('fimfic2epub')

function generateEpub (id) {
  return new Promise((resolve, reject) => {
    const ffc = new FimFic2Epub(id)

    return ffc.download().then(ffc.getFile()).then((file) => {
      resolve({file: file, filename: ffc.filename})
    }).catch(reject)
  })
}

module.exports = generateEpub
