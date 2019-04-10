'use strict'

const sendfile = require('koa-sendfile')
const fs = require('fs')
const path = require('path')
const thenify = require('thenify')
const FimFic2Epub = require('fimfic2epub').default
const generateEpub = require(path.join(__dirname, '/generateEpub'))
const config = require(path.join(__dirname, '/../config.json'))
const spawn = require('child_process').spawn

const fsreadFile = thenify(fs.readFile)
const fsStat = thenify(fs.stat)

const promiseCache = new Map()

function * handleDownload (id) {
  id = parseInt(id, 10)
  if (isNaN(id) || id <= 0) {
    return
  }

  let outputKepub = false

  if (/\.kepub\.epub$/.test(this.request.url)) {
    outputKepub = true
  }

  let cacheEnabled = !!config.archive
  let useCache = false
  let storyInfo, cachedInfo
  let file, filename
  let infoFile = path.join(__dirname, '/../archive/' + id + '.json')
  let storyFile = path.join(__dirname, '/../archive/' + id + '.epub')

  let inProgress = promiseCache.has(id)

  if (!inProgress) {
    if (cacheEnabled) {
      try {
        cachedInfo = JSON.parse(yield fsreadFile(infoFile, 'utf8'))
        yield fsStat(storyFile)
        useCache = true
      } catch (err) {
        console.warn('' + err)
      }
    }

    try {
      storyInfo = yield FimFic2Epub.fetchStoryInfo(id)
    } catch (err) {
      console.error(err)
      return
    }

    if (cacheEnabled && useCache) {
      if (JSON.stringify(storyInfo) !== JSON.stringify(cachedInfo)) {
        console.log('Cached metadata differ')
        useCache = false
      }
    }

    if (cacheEnabled && useCache) {
      filename = FimFic2Epub.getFilename(storyInfo)
      if (outputKepub) filename = filename.replace(/\.epub$/, '.kepub.epub')
      console.log('Serving cached ' + filename)
      this.response.attachment(filename)
      if (outputKepub) {
        storyFile = yield kepubify(id, storyFile, true)
      }
      yield sendfile(this, storyFile)
      if (outputKepub) {
        fs.unlink(storyFile)
      }
      return
    } else {
      let pr = generateEpub(id)
      promiseCache.set(id, pr)

      ;({ file, filename } = yield pr)
      if (outputKepub) filename = filename.replace(/\.epub$/, '.kepub.epub')

      promiseCache.delete(id)

      console.log('Serving generated ' + filename)
      fs.writeFile(storyFile, file, () => {})
      fs.writeFile(infoFile, JSON.stringify(storyInfo), 'utf8', () => {})
    }
  } else {
    // hook on to an already running generator
    console.log('Hooking on to running epub generator for story ' + id)
    ;({ file, filename } = yield promiseCache.get(id))
    if (outputKepub) filename = filename.replace(/\.epub$/, '.kepub.epub')
    console.log('Serving ' + filename)
  }

  this.response.type = 'epub'
  this.response.attachment(filename)

  if (outputKepub) {
    file = yield kepubify(id, file, false)
  }

  this.response.body = file
}

function kepubify (id, file, returnPath = false) {
  return new Promise((resolve, reject) => {
    const fileid = Math.floor(Math.random() * 10000) + '-' + id
    let epubPath = '/tmp/fimfic2epub-' + fileid + '.epub'
    const kepubPath = '/tmp/fimfic2epub-' + fileid + '.kepub.epub'
    const tmpPath = '/tmp/fimfic2epub-' + fileid

    function handleKepubifier () {
      const kepubifier = spawn('./src/kepubify.sh', [epubPath, kepubPath, tmpPath], {
        stdio: 'inherit'
      })
      kepubifier.once('exit', (code) => {
        if (code !== 0) {
          reject(new Error('Error while kepubifying'))
          return
        }
        if (typeof file !== 'string') {
          fs.unlink(epubPath)
        }
        if (returnPath) {
          resolve(kepubPath)
        } else {
          fs.readFile(kepubPath, (err, data) => {
            if (err) {
              reject(err)
              return
            }
            resolve(data)
            fs.unlink(kepubPath)
          })
        }
      })
    }

    if (typeof file === 'string') {
      epubPath = file
      handleKepubifier()
    } else {
      fs.writeFile(epubPath, file, (err) => {
        if (err) {
          reject(err)
          return
        }
        handleKepubifier()
      })
    }
  })
}




module.exports = handleDownload
