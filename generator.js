'use strict'

const FimFic2Epub = require('fimfic2epub')

function generateEpub (id) {
  const ffc = new FimFic2Epub(id)
  return ffc.download().then(ffc.getFile.bind(ffc)).then((file) => {
    return {file: file, filename: ffc.filename}
  })
}

module.exports = generateEpub
