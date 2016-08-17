'use strict'

const route = require('koa-route')
const logger = require('koa-logger')
const serve = require('koa-static')
const favicon = require('koa-favicon')
const ratelimit = require('koa-ratelimit')
const path = require('path')
const redis = require('redis')
const handleDownload = require(path.join(__dirname, '/handleDownload'))
const config = require(path.join(__dirname, '/../config.json'))

module.exports = function (app) {
  app.use(favicon(path.join(__dirname, '/../static/favicon.ico')))

  app.use(logger())

  app.use(serve(path.join(__dirname, '/../static/')))

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
}
