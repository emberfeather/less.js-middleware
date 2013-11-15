"use strict";

/*!
 * Less - middleware (adapted from the stylus middleware)
 *
 * Copyright(c) 2013 Randy Merrill <Zoramite+github@gmail.com>
 * MIT Licensed
 */

var less = require('less'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    extend = require('node.extend'),
    determine_imports = require('./determine-imports.js');

// Import map
var imports = {},
    regex = {
      handle: /\.css$/,
      compress: /(\.|-)min\.css$/
    },
    options, parserOptions, toCSSOptions,
    src, dest, root, debug, render, prefix,
    defaultPaths, once, preprocessor, force;

// Only log if in debug mode
function log(key, val, type) {
  if (debug || type === 'error') {
    switch(type) {
      case 'log':
      case 'info':
      case 'error':
      case 'warn':
        break;
      default:
        type = 'log';
    }

    console[type]("  \u001b[90m%s :\u001b[0m \u001b[36m%s\u001b[0m", key, val);
  }
};

// Print Less errors to console.
function lessError(err) {
  log("LESS " + err.type + ' error', err.message, 'error');
  log("LESS File", err.filename + ' ' + err.line + ':' + err.column, 'error');
};

// Check imports for changes
function checkImports(path, next) {
  var nodes = imports[path];

  if (!nodes || !nodes.length) {
    return next();
  }

  var pending = nodes.length;
  var changed = [];

  nodes.forEach(function(imported) {
    fs.stat(imported.path, function(err, stat) {
      // error or newer mtime
      if (err || !imported.mtime || stat.mtime > imported.mtime) {
        changed.push(imported.path);
      }

      --pending || next(changed);
    });
  });
};

function defaultRender(str, lessPath, cssPath, callback) {

  var paths = [ path.dirname(lessPath) ];
  defaultPaths.forEach(function(p) { paths.push(p); });

  parseOptions.paths = paths;
  parseOptions.filename = lessPath;

  toCSSOptions.compress = (options.compress == 'auto' ? regex.compress.test(cssPath) : options.compress)

  var parser = new less.Parser(parseOptions);

  parser.parse(str, function(err, tree) {
      if (err) {
        return callback(err);
      }

      try {
        var css = tree.toCSS(toCSSOptions);

        // Store the less import paths
        imports[lessPath] = determine_imports(tree, lessPath, defaultPaths);

        callback(err, css);
      } catch (parseError) {
        callback(parseError, null);
      }
  });
};

// Ignore ENOENT to fall through as 404
function error(err) {
  return next('ENOENT' == err.code ? null : err);
};

function parseOptions(config) {

  options = {};

  /*
   * Middleware Options
   */

  // Accept src/dest dir
  if ('string' === typeof config) {
    config = { src: config };
  }

  // Once option
  once = config.once || false;

  // Preprocessor
  preprocessor = config.preprocessor || function(src, req) { return src; };

  // Source dir required
  src = config.src;
  if (!src) { throw new Error('less.middleware() requires "src" directory'); }

  // Default dest dir to source
  dest = config.dest ? config.dest : src;

  // Allow root to redefine how paths are managed
  root = config.root || null;

  // Default compile callback
  render = config.render || defaultRender

  // Add tree functions if provided.
  extend(less.tree.functions, config.treeFunctions || {});

  debug = config.debug

  prefix = config.prefix

  force = config.force


  /*
   * LESS Options
   */

  // paths updated in defaultRender
  if (config.paths) {
    if (!(config.paths instanceof Array)) {
      defaultPaths = [config.paths];
    }
  } else {
    defaultPaths = [];
  }

  // Compress option
  options.compress = typeof config.compress === 'undefined' ? 'auto' : config.compress;

  // YUI Compress option
  options.yuicompress = typeof config.yuicompress === 'undefined' ? false : config.yuicompress;

  // Optimization option
  options.optimization = config.optimization || 0;

  // Line Number Tracking
  options.dumpLineNumbers = config.dumpLineNumbers || 0;

  // Relative paths?
  options.relativeUrls = config.relativeUrls || false;

  // Source map
  options.sourceMap = config.sourceMap || false;


  /*
   * Create options objects
   */

  // parseOptions.paths updated in defaultRender
  // parseOptions.filename handled in defaultRender
  parseOptions = {
    optimization: options.optimization,
    dumpLineNumbers: options.dumpLineNumbers,
    relativeUrls: options.relativeUrls
  }

  toCSSOptions = {
    yuicompress: options.yuicompress,
    sourceMap: options.sourceMap
  }
}

/**
 * Return Connect middleware with the given `options`.
 *
 * Options:
 *
 *    `force`           Always re-compile
 *    `once`            Only re-compile the one time
 *    `debug`           Output debugging information
 *    `src`             Source directory used to find .less files
 *    `dest`            Destination directory used to output .css files
 *                      when undefined defaults to `src`.
 *    `prefix`          Path which should be stripped from `pathname`.
 *    `compress`        Whether the output .css files should be compressed
 *    `yuicompress`     Same as `compress`, but uses YUI Compressor
 *    `optimization`    The desired value of the less optimization option (0, 1, or 2. 0 is default)
 *    `dumpLineNumbers` Add line tracking to the compiled css. ('comments' or 'mediaquery')
 *    `preprocessor`    Function to transform input .less code before parsing,
 *                      receives source code and Connect request object as parameters
 *
 * Examples:
 *
 * Pass the middleware to Connect, grabbing .less files from this directory
 * and saving .css files to _./public_. Also supplying our custom `compile` function.
 *
 * Following that we have a `static` layer setup to serve the .css
 * files generated by Less.
 *
 *      var server = connect.createServer(
 *          less.middleware({
 *              src: __dirname + '/public',
 *              compress: true
 *          })
 *        , connect.static(__dirname + '/public')
 *      );
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */
module.exports = less.middleware = function(config) {

  parseOptions(config);

  // Middleware
  return function(req, res, next) {
    if ('GET' != req.method.toUpperCase() && 'HEAD' != req.method.toUpperCase()) { return next(); }

    var pathname = url.parse(req.url).pathname;

    // Only handle the matching files
    if (regex.handle.test(pathname)) {
      if (prefix && 0 === pathname.indexOf(prefix)) {
        pathname = pathname.substring(prefix.length);
      }

      var cssPath = path.join(dest, pathname);
      var lessPath = path.join(src, (
        regex.compress.test(pathname)
        ? pathname.replace(regex.compress, '.less')
        : pathname.replace('.css', '.less'
      )));

      if (root) {
        cssPath = path.join(root, dest, pathname.replace(dest, ''));
        lessPath = path.join(root, src, pathname
            .replace(dest, '')
            .replace('.css', '.less'));
      }

      log('source', lessPath);
      log('dest', cssPath);


      // Force
      if (force) { return compile(); }

      // Re-compile on server restart, disregarding
      // mtimes since we need to map imports
      if (!imports[lessPath]) { return compile(); }

      // Only check/recompile if it has not been done at before
      if (once && imports[lessPath]) { return next(); }

      // Compare mtimes
      fs.stat(lessPath, function(err, lessStats) {
        if (err) { return error(err); }

        fs.stat(cssPath, function(err, cssStats) {
          // CSS has not been compiled, compile it!
          if (err) {
            if ('ENOENT' == err.code) {
              log('not found', cssPath);

              // No CSS file found in dest
              return compile();
            } else {
              return next(err);
            }
          } else if (lessStats.mtime > cssStats.mtime) {
            // Source has changed, compile it
            log('modified', cssPath);

            return compile();
          } else {
            // Check if any of the less imports were changed
            checkImports(lessPath, function(changed) {
              if (typeof changed != "undefined" && changed.length) {
                log('modified import', changed);

                return compile();
              }

              return next();
            });
          }
        });
      });
    } else {
      return next();
    }

    // Compile to cssPath
    function compile() {
      log('read', lessPath);

      fs.readFile(lessPath, 'utf8', function(err, str) {
        if (err) { return error(err); }

        delete imports[lessPath];

        try {
          var preprocessed = preprocessor(str, req);
          render(preprocessed, lessPath, cssPath, function(err, css) {
            if (err) {
              lessError(err);

              return next(err);
            }

            log('render', lessPath);

            mkdirp(path.dirname(cssPath), 511 /* 0777 */, function(err) {
              if (err) return error(err);

              fs.writeFile(cssPath, css, 'utf8', next);
            });
          });
        } catch (err) {
          lessError(err);

          return next(err);
        }
      });
    };
  };
};
