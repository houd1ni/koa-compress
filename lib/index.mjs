'use strict'

/**
 * Module dependencies.
 */

import {always, F, mergeDeep, prop} from 'pepka'
import {Readable} from 'stream'
import compressible from './local-libs/compressible.js'
import isJSON from 'koa-is-json'
import statuses from 'statuses'
import Stream from 'stream'
import bytes from 'bytes'
import Encodings from './encodings.js'

const { empty } = statuses
const { preferredEncodings: _preferredEncodings, encodingMethodDefaultOptions, encodingMethods } = Encodings

/**
* Regex to match no-transform directive in a cache-control header
*/
const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/

/**
 * Compress middleware.
 *
 * @param {Object} [options]
 * @return {Function}
 * @api public
 */

export default (options = {}) => {
  
  let { filter, threshold, defaultEncoding, cache: cache_opts } = mergeDeep({
    filter: compressible,
    threshold: 1024,
    defaultEncoding: 'identity',
    cache: {
      cond: F, // (ctx) => boolean.
      hash: prop('url'), // (ctx) => hash string.
      store: Map, // Cache store constructor.
      timeout: always(Infinity) // (ctx) => ttl inn seconds.
    }
  }, options)
  if (typeof threshold === 'string') threshold = bytes(threshold)
  const cache = new cache_opts.store()

  // `options.br = false` would remove it as a preferred encoding
  const preferredEncodings = _preferredEncodings.filter((encoding) =>
    options[encoding] !== false && options[encoding] !== null
  )
  const encodingOptions = {}
  preferredEncodings.forEach((encoding) => {
    encodingOptions[encoding] = {
      ...encodingMethodDefaultOptions[encoding],
      ...(options[encoding] || {})
    }
  })

  return async function compressMiddleware(ctx, next) {
    ctx.vary('Accept-Encoding')

    await next()

    // early exit if there's no content body or the body is already encoded
    let { body } = ctx
    if (!body) return
    if (ctx.res.headersSent || !ctx.writable) return
    if (ctx.compress === false) return
    if (ctx.request.method === 'HEAD') return
    if (empty[ctx.response.status]) return
    if (ctx.response.get('Content-Encoding')) return

    // forced compression or implied
    if (!(ctx.compress === true || filter(ctx.response.type))) return

    // don't compress for Cache-Control: no-transform
    // https://tools.ietf.org/html/rfc7234#section-5.2.1.6
    const cacheControl = ctx.response.get('Cache-Control')
    if (cacheControl && NO_TRANSFORM_REGEX.test(cacheControl)) return

    // don't compress if the current response is below the threshold
    if (threshold && ctx.response.length < threshold) return

    // get the preferred content encoding
    const encodings = new Encodings({
      preferredEncodings
    })
    encodings.parseAcceptEncoding(ctx.request.headers['accept-encoding'] || defaultEncoding)
    const encoding = encodings.getPreferredContentEncoding()

    // identity === no compression
    if (encoding === 'identity') return

    /** begin compression logic **/

    // json
    if (isJSON(body)) body = ctx.body = JSON.stringify(body)

    ctx.set('Content-Encoding', encoding)
    ctx.res.removeHeader('Content-Length')

    const cache_hash = cache_opts.hash(ctx)
    const is_stream = body instanceof Stream
    if(cache.has(cache_hash)) {
      // console.log({is_stream, body}) ReadStream
      return ctx.body = Readable.from(cache.get(cache_hash))
    }
    const compress = encodingMethods[encoding]
    const stream = ctx.body = compress(encodingOptions[encoding])
    if(cache_opts.cond(ctx)) {
      let cache_item = Buffer.allocUnsafe(0)
      stream.on('data', (chunk) => cache_item = Buffer.concat([cache_item, chunk]))
      stream.on('end', () => cache.set(cache_hash, cache_item))
      const to = cache_opts.timeout(ctx)
      if(to<Infinity) setTimeout(() => cache.delete(cache_hash), to*1e3)
    }

    if(is_stream) {
      body.pipe(stream)
    } else {
      stream.end(body)
    }
  }
}
