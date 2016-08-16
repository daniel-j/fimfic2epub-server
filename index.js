#!/usr/bin/env node

const FimFic2Epub = require('fimfic2epub')

const koa = require('koa')
const route = require('koa-route')
const logger = require('koa-logger')
const send = require('koa-send')
const favicon = require('koa-favicon')
const app = koa()
const config = require(__dirname + '/config.json')

app.name = 'fimfic2epub-server'
app.port = config.port
if (config.proxy) app.proxy = config.proxy

app.use(favicon(__dirname + '/favicon.ico'))

app.use(logger())

app.use(route.get('/', function *() {
  yield send(this, './index.html')
}))

function *handleDownload (id) {
  const ffc = new FimFic2Epub(id)

  yield ffc.download()

  let file = yield ffc.getFile()

  this.response.type = 'application/epub+zip'
  this.response.attachment(ffc.filename)

  this.response.body = file
}

app.use(route.get('/story/:id/download', handleDownload))
app.use(route.get('/story/:id/download/*', handleDownload))

module.exports = app
