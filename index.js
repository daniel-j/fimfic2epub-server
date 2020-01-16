#!/usr/bin/env node
'use strict'

// Fix for mithril
// use a mock DOM so we can run mithril in nodejs
const mock = require('mithril/test-utils/browserMock')(global)
global.requestAnimationFrame = mock.requestAnimationFrame

const path = require('path')
const koa = require('koa')
const serverSetup = require(path.join(__dirname, '/server'))
const config = require(path.join(__dirname, '/config.json'))

const app = koa()

app.name = 'fimfic2epub-server'
app.port = config.port
if (config.proxy) app.proxy = config.proxy

serverSetup(app)

app.listen(app.port, () => {
  console.log('Listening on port', app.port)
})
