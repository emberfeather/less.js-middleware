"use strict";

/*!
 * Less - middleware (adapted from the stylus middleware)
 *
 * Copyright(c) 2014 Randy Merrill <Zoramite+github@gmail.com>
 * MIT Licensed
 */

var extend = require('node.extend');
var fs = require('fs');
var less = require('less');
var mkdirp = require('mkdirp');
var path = require('path');
var url = require('url');
var utilities = require('./utilities');

// Import mapping with mtimes
var lessFiles = {};

/**
 * Return Connect middleware with the given `options`.
 */
module.exports = less.middleware = function(source, options){
  // Source dir is required.
  if (!source) {
    throw new Error('less.middleware() requires `source` directory');
  }

  // Override the defaults for the middleware.
  options = extend(true, {
    debug: false,
    dest: source,
    force: false,
    once: false,
    pathRoot: null,
    postprocess: {
      css: function(css, req) { return css; },
      sourcemap: function(sourcemap, req) { return sourcemap; }
    },
    preprocess: {
      less: function(src, req) { return src; },
      path: function(pathname, req) { return pathname; }
    },
    render: {
      compress: 'auto',
      yuicompress: false
    },
    storeCss: function(pathname, css, req, next) {
      mkdirp(path.dirname(pathname), 511 /* 0777 */, function(err){
        if (err) return next(err);

        fs.writeFile(pathname, css, 'utf8', next);
      });
    },
    storeSourcemap: function(pathname, sourcemap, req) {
      mkdirp(path.dirname(pathname), 511 /* 0777 */, function(err){
        if (err) {
          utilities.lessError(err);
          return;
        }

        fs.writeFile(pathname, sourcemap, 'utf8');
      });
    }
  }, options || {});

  // The log function is determined by the debug option.
  var log = (options.debug ? utilities.logDebug : utilities.log);

  // Actual middleware.
  return function(req, res, next) {
    if ('GET' != req.method.toUpperCase() && 'HEAD' != req.method.toUpperCase()) { return next(); }

    var pathname = url.parse(req.url).pathname;

    // Only handle the matching files in this middleware.
    if (utilities.isValidPath(pathname)) {
      var isSourceMap = utilities.isSourceMap(pathname);

      // Translate source maps to a normal .css request which will update the associated source-map.
      if( isSourceMap ){
        pathname = pathname.replace( /\.map$/, '' );
      }
      var lessPath = path.join(source, utilities.maybeCompressedSource(pathname));
      var cssPath = path.join(options.dest, pathname);

      if (options.pathRoot) {
        pathname = pathname.replace(options.dest, '');
        cssPath = path.join(options.pathRoot, options.dest, pathname);
        lessPath = path.join(options.pathRoot, source, utilities.maybeCompressedSource(pathname));
      }

      var sourcemapPath = cssPath + '.map';

      // Allow for preprocessing the source filename.
      lessPath = options.preprocess.path(lessPath, req);

      log('pathname', pathname);
      log('source', lessPath);
      log('destination', cssPath);

      // Ignore ENOENT to fall through as 404.
      var error = function(err) {
        return next('ENOENT' == err.code ? null : err);
      };

      var compile = function() {
        fs.readFile(lessPath, 'utf8', function(err, lessSrc){
          if (err) {
            return error(err);
          }

          delete lessFiles[lessPath];

          try {
            lessSrc = options.preprocess.less(lessSrc, req);
            options.render.filename = lessPath;
            less.render(lessSrc, options.render, function(err, output){
              if (err) {
                utilities.lessError(err);
                return next(err);
              }

              // Store the less paths for simple cache invalidation.
              lessFiles[lessPath] = {
                mtime: Date.now()
              };

              if(output.map) {
                // Postprocessing on the sourcemap.
                var map = options.postprocess.sourcemap(output.map, req);

                // Custom sourcemap storage.
                options.storeSourcemap(sourcemapPath, map, req);
              }

              // Postprocessing on the css.
              var css = options.postprocess.css(output.css, req);

              // Custom css storage.
              options.storeCss(cssPath, css, req, next);
            });
          } catch (err) {
            utilities.lessError(err);
            return next(err);
          }
        });
      };

      // Force recompile of all files.
      if (options.force) {
        return compile();
      }

      // Only compile once, disregarding the file changes.
      if (options.once && lessFiles[lessPath]) {
        return next();
      }

      // Compile on server restart and new files.
      if (!lessFiles[lessPath]) {
        return compile();
      }

      // Compare mtimes to determine if changed.
      fs.stat(lessPath, function(err, lessStats){
        if (err) {
          return error(err);
        }

        fs.stat(cssPath, function(err, cssStats){
          // CSS has not been compiled, compile it!
          if (err) {
            if ('ENOENT' == err.code) {
              log('not found', cssPath);

              // No CSS file found in dest
              return compile();
            }

            return next(err);
          }

          if (lessStats.mtime > cssStats.mtime) {
            // Source has changed, compile it
            log('modified', cssPath);

            return compile();
          } else if (lessStats.mtime > lessFiles[lessPath].mtime) {
            // This can happen if lessFiles[lessPath] was copied from
            // cachedLessFiles above, but the cache file was out of date (which
            // can happen e.g. if node is killed and we were unable to write out
            // lessFiles on exit). Since imports might have changed, we need to
            // recompile.
            log('cache file out of date for', lessPath);

            return compile();
          } else {
            return next();
          }
        });
      });
    } else {
      return next();
    }
  };
};
