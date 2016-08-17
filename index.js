#!/usr/bin/env node
'use strict'

const koa = require('koa')
const route = require('koa-route')
const logger = require('koa-logger')
const send = require('koa-send')
const favicon = require('koa-favicon')
const ratelimit = require('koa-ratelimit')
const fs = require('fs')
const path = require('path')
const redis = require('redis')
const thenify = require('thenify')

const FimFic2Epub = require('fimfic2epub')

const generateEpub = require(path.join(__dirname, '/generator'))
const config = require(path.join(__dirname, '/config.json'))

const app = koa()

const fsreadFile = thenify(fs.readFile)
const fsStat = thenify(fs.stat)

const promiseCache = new Map()

app.name = 'fimfic2epub-server'
app.port = config.port
if (config.proxy) app.proxy = config.proxy

app.use(favicon(path.join(__dirname, '/favicon.ico')))

app.use(logger())

app.use(route.get('/', function * () {
  yield send(this, './index.html')
}))

function * handleDownload (id) {
  id = parseInt(id, 10)
  if (isNaN(id) || id === 0) {
    return
  }

  let cacheEnabled = !!config.archive
  let useCache = false
  let storyInfo, cachedInfo
  let file, filename
  let infoFile = 'archive/' + id + '.json'
  let storyFile = 'archive/' + id + '.epub'

  let inProgress = promiseCache.has(id)

  if (!inProgress) {
    if (cacheEnabled) {
      try {
        cachedInfo = JSON.parse(yield fsreadFile(infoFile, 'binary'))
        yield fsStat(storyFile)
        useCache = true
      } catch (err) {
        console.error('' + err)
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
      file = yield fsreadFile(storyFile)
      filename = FimFic2Epub.getFilename(storyInfo)
      console.log('Serving cached ' + filename)
    } else {
      let pr = generateEpub(id)
      promiseCache.set(id, pr)

      ;({ file, filename } = yield pr)

      promiseCache.delete(id)

      console.log('Serving generated ' + filename)
      fs.writeFile(storyFile, file)
      fs.writeFile(infoFile, JSON.stringify(storyInfo), 'binary')
    }
  } else {
    // hook on to an already running generator
    console.log('Hooking on to running epub generator for story ' + id)
    ;({ file, filename } = yield promiseCache.get(id))
  }

  this.response.type = 'application/epub+zip'
  this.response.attachment(filename)

  this.response.body = file
}

// this will rate limit the download/generation of epub files
if (config.ratelimit && config.ratelimit.enabled) {
  app.use(ratelimit({
    db: redis.createClient(),
    duration: (config.ratelimit.duration || 60) * 60 * 1000,
    max: (config.ratelimit.max || 20),
    id (context) {
      console.log('IP:', context.ip)
      return context.ip
    }
  }))
}

app.use(route.get('/story/:id/download', handleDownload))
app.use(route.get('/story/:id/download/*', handleDownload))

app.listen(app.port, () => {
  console.log('Listening on port', app.port)
})
