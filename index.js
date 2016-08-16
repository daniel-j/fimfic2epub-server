#!/usr/bin/env node
'use strict'

const koa = require('koa')
const route = require('koa-route')
const logger = require('koa-logger')
const send = require('koa-send')
const favicon = require('koa-favicon')
const fs = require('fs')
const thenify = require('thenify')

const FimFic2Epub = require('fimfic2epub')

const generateEpub = require(__dirname + '/generator')
const config = require(__dirname + '/config.json')

const app = koa()

const fsreadFile = thenify(fs.readFile)
const fsStat = thenify(fs.stat)

const promiseCache = new Map()

app.name = 'fimfic2epub-server'
app.port = config.port
if (config.proxy) app.proxy = config.proxy

app.use(favicon(__dirname + '/favicon.ico'))

app.use(logger())

app.use(route.get('/', function *() {
  yield send(this, './index.html')
}))

function *handleDownload (id) {
  id = parseInt(id, 10)
  if (isNaN(id) || id === 0) {
    return
  }

  let useCache = false
  let storyInfo, cachedInfo
  let file, filename
  let infoFile = 'archive/' + id + '.json'
  let storyFile = 'archive/' + id + '.epub'

  let inProgress = promiseCache.has(id)

  if (!inProgress) {
    try {
      cachedInfo = JSON.parse(yield fsreadFile(infoFile))
      yield fsStat(storyFile)
      useCache = true
    } catch (err) { }

    try {
      storyInfo = yield FimFic2Epub.fetchStoryInfo(id)
    } catch (err) {
      console.error(err)
      return
    }

    if (useCache) {
      if (JSON.stringify(storyInfo) !== JSON.stringify(cachedInfo)) {
        useCache = false
      }
    }

    if (useCache) {
      file = yield fsreadFile(storyFile)
      filename = FimFic2Epub.getFilename(storyInfo)
      console.log('Serving cached ' + filename)
    } else {
      let pr = generateEpub(id)
      promiseCache.set(id, pr)

      let o = yield pr
      file = o.file
      filename = o.filename

      promiseCache.delete(id)
      console.log('Serving generated ' + filename)
      fs.writeFile(storyFile, file)
      fs.writeFile(infoFile, JSON.stringify(storyInfo))
    }
  } else {
    // hook on to an already running generator
    ({file, filename} = yield promiseCache.get(id))
  }

  this.response.type = 'application/epub+zip'
  this.response.attachment(filename)

  this.response.body = file
}

app.use(route.get('/story/:id/download', handleDownload))
app.use(route.get('/story/:id/download/*', handleDownload))

app.listen(app.port)
console.log('Listening on', app.port)
