#!/usr/bin/env node

const FimFic2Epub = require('fimfic2epub')

const koa = require('koa')
const route = require('koa-route')
const logger = require('koa-logger')
const send = require('koa-send')
const favicon = require('koa-favicon')
const app = koa()
const config = require(__dirname + '/config.json')
const thenify = require('thenify')
const fs = require('fs')

const fsreadFile = thenify(fs.readFile)
const fswriteFile = thenify(fs.writeFile)

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

  let useCache = true
  let storyInfo, cachedInfo
  let infoFile = 'archive/' + id + '.json'
  let storyFile = 'archive/' + id + '.epub'

  try {
    cachedInfo = JSON.parse(yield fsreadFile(infoFile))
  } catch (err) { }
  try {
    storyInfo = yield FimFic2Epub.fetchStoryInfo(id)
  } catch (err) { }

  if (storyInfo && !cachedInfo) {
    useCache = false
  } else if (storyInfo && cachedInfo) {
    if (JSON.stringify(storyInfo) !== JSON.stringify(cachedInfo)) {
      useCache = false
    }
  } else if (!storyInfo && !cachedInfo) {
    return
  }

  storyInfo = storyInfo || cachedInfo

  let file, filename

  if (useCache) {
    file = yield fsreadFile(storyFile)
    filename = FimFic2Epub.getFilename(storyInfo)
    console.log('Serving cached ' + filename)
  } else {
    const ffc = new FimFic2Epub(id)

    yield ffc.download()

    file = yield ffc.getFile()
    filename = ffc.filename

    console.log('Serving generated ' + filename)

    fswriteFile(storyFile, file)
    fswriteFile(infoFile, JSON.stringify(storyInfo))
  }

  this.response.type = 'application/epub+zip'
  this.response.attachment(filename)

  this.response.body = file
}

app.use(route.get('/story/:id/download', handleDownload))
app.use(route.get('/story/:id/download/*', handleDownload))

module.exports = app
