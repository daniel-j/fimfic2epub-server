#!/usr/bin/env node

const FimFic2Epub = require('fimfic2epub')

const koa = require('koa')
const route = require('koa-route')
const logger = require('koa-logger')
const send = require('koa-send')
const app = koa()

const port = process.argv[2] || 3000

app.use(logger())

app.use(route.get('/story/:id/download', function *(id) {
  const ffc = new FimFic2Epub(id)

  yield ffc.download()

  this.response.type = 'application/epub+zip'
  this.response.attachment(ffc.filename)

  this.response.body = ffc.streamFile()
}))

app.use(route.get('/', function *() {
  yield send(this, './index.html')
}))

app.listen()

console.log('Listening on port ' + port)
