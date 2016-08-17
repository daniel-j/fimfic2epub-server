'use strict'

const sendfile = require('koa-sendfile')
const fs = require('fs')
const path = require('path')
const thenify = require('thenify')
const FimFic2Epub = require('fimfic2epub')
const generateEpub = require(path.join(__dirname, '/generateEpub'))
const config = require(path.join(__dirname, '/../config.json'))

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
        cachedInfo = JSON.parse(yield fsreadFile(infoFile, 'binary'))
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
      yield sendfile(this, storyFile)
      return
    } else {
      let pr = generateEpub(id)
      promiseCache.set(id, pr)

      ;({ file, filename } = yield pr)
      if (outputKepub) filename = filename.replace(/\.epub$/, '.kepub.epub')

      promiseCache.delete(id)

      console.log('Serving generated ' + filename)
      fs.writeFile(storyFile, file)
      fs.writeFile(infoFile, JSON.stringify(storyInfo), 'binary')
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

  this.response.body = file
}

module.exports = handleDownload
