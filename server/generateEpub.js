'use strict'

const FimFic2Epub = require('fimfic2epub').default

function generateEpub (id, options) {
  const ffc = new FimFic2Epub(id)
  ffc.on('progress', (percent, status) => {
    if (status) {
      // console.log(status)
    }
  })
  return ffc.fetchAll()
    .then(ffc.build.bind(ffc))
    .then(ffc.getFile.bind(ffc)).then((file) => {
      return {file: file, filename: ffc.filename}
    })
}

module.exports = generateEpub
