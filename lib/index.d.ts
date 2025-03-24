/* =================== USAGE ===================


    import compress = require("koa-compress");

    var Koa = require('koa');


    var app = new Koa();

    app.use(compress());


 =============================================== */

/// <reference types="node" />

/// <reference types="koa" />


import * as Koa from "koa";

import * as zlib from "zlib";


/**

 * Compress middleware for Koa

 */

declare function koaCompress(options?: koaCompress.CompressOptions): Koa.Middleware;


declare namespace koaCompress {

    export interface CompressOptions {

        /**

         * An optional function that checks the response content type to decide whether to compress. By default, it uses compressible.

         */

        filter?: ((mimeType: string) => boolean) | undefined;


        /**

         * Minimum response size in bytes to compress. Default 1024 bytes or 1kb.

         */

        threshold?: number | string | undefined;


        /**

         * An optional string, which specifies what encoders to use for requests

         * without Accept-Encoding. Default: 'idenity'.

         */

        defaultEncoding?: string | undefined;


        /**

         * Options for brotli compression.

         */

        br?: zlib.BrotliOptions | false | undefined;


        /**

         * Options for gzip compression.

         */

        gzip?: zlib.ZlibOptions | false | undefined;


        /**

         * Options for deflate compression.

         */

        deflate?: zlib.ZlibOptions | false | undefined;

        cache: Partial<{
          /** Cache condition. Defaults to always false. */
          cond: (ctx: Koa.Context) => boolean
          /** Hash string generator. Defaults to ctx.url. */
          hash: (ctx: Koa.Context) => string
          /** Cache store constructor. Defaults to Map. Should have .set .get .has. */
          store: Function
          /** TTL in seconds. */
          timeout: (ctx: Koa.Context) => number
        }>
    }

}


export default koaCompress