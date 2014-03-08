"use strict";

/*!
 * Less - middleware (adapted from the stylus middleware)
 *
 * Copyright(c) 2014 Randy Merrill <Zoramite+github@gmail.com>
 * MIT Licensed
 */

var determine_imports = require('./determine-imports');
var extend = require('node.extend');
var fs = require('fs');
var less = require('less');
var mkdirp = require('mkdirp');
var path = require('path');
var utilities = require('./utilities');

// Import mapping.
var imports = {};

// Check imports for changes.
var checkImports = function(path, next) {
  var nodes = imports[path];

  if (!nodes || !nodes.length) {
    return next();
  }

  var pending = nodes.length;
  var changed = [];

  nodes.forEach(function(imported){
    fs.stat(imported.path, function(err, stat) {
      // error or newer mtime
      if (err || !imported.mtime || stat.mtime > imported.mtime) {
        changed.push(imported.path);
      }

      --pending || next(changed);
    });
  });
};

/**
 * Return Connect middleware with the given `options`.
 */
module.exports = less.middleware = function(source, options, parserOptions, compilerOptions){
  // Check for 0.1.x usage.
  if (typeof source == 'object') {
    throw new Error('Please update your less-middleware usage: http://goo.gl/YnK8p0');
  }

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
      css: function(css, req) { return css; }
    },
    preprocess: {
      less: function(src, req) { return src; },
      path: function(pathname, req) { return pathname; }
    },
    storeCss: function(pathname, css, next) {
      mkdirp(path.dirname(pathname), 511 /* 0777 */, function(err){
        if (err) return next(err);

        fs.writeFile(pathname, css, 'utf8', next);
      });
    }
  }, options || {});

  // Override the defaults for the parser.
  parserOptions = extend(true, {
    dumpLineNumbers: 0,
    paths: [source],
    optimization: 0,
    relativeUrls: false
  }, parserOptions || {});

  // Override the defaults for the compiler.
  compilerOptions = extend(true, {
    compress: 'auto',
    sourceMap: false,
    yuicompress: false
  }, compilerOptions || {});

  // The log function is determined by the debug option.
  var log = (options.debug ? utilities.logDebug : utilities.log);

  // Parse and compile the CSS from the source string.
  var render = function(str, lessPath, cssPath, callback) {
    var parser = new less.Parser(extend({}, parserOptions, {
      filename: lessPath
    }));

    parser.parse(str, function(err, tree) {
      if(err) {
        return callback(err);
      }

      try {
        var css = tree.toCSS(extend({}, compilerOptions, {
          compress: (options.compress == 'auto' ? utilities.isCompressedPath(cssPath) : options.compress)
        }));

        // Store the less import paths for cache invalidation.
        imports[lessPath] = determine_imports(tree, lessPath, parserOptions.paths);

        callback(err, css);
      } catch(parseError) {
        callback(parseError, null);
      }
    });
  };

  // Actual middleware.
  return function(req, res, next) {
    if ('GET' != req.method.toUpperCase() && 'HEAD' != req.method.toUpperCase()) { return next(); }

    var pathname = req.path;

    // Only handle the matching files in this middleware.
    if (utilities.isValidPath(pathname)) {
      var cssPath = path.join(options.dest, pathname);
      var lessPath = path.join(source, utilities.maybeCompressedSource(pathname));

      if (options.pathRoot) {
        pathname = pathname.replace(options.dest, '');
        cssPath = path.join(options.pathRoot, options.dest, pathname);
        lessPath = path.join(options.pathRoot, source, utilities.maybeCompressedSource(pathname));
      }

      // Allow for preprocessing the source filename.
      lessPath = options.preprocess.path(lessPath, req);

      log('source', lessPath);
      log('dest', cssPath);

      // Ignore ENOENT to fall through as 404.
      var error = function(err) {
        return next('ENOENT' == err.code ? null : err);
      };

      var compile = function() {
        log('read', lessPath);

        fs.readFile(lessPath, 'utf8', function(err, lessSrc){
          if (err) {
            return error(err);
          }

          delete imports[lessPath];

          try {
            lessSrc = options.preprocess.less(lessSrc, req);
            render(lessSrc, lessPath, cssPath, function(err, css){
              if (err) {
                utilities.lessError(err);
                return next(err);
              }

              log('render', cssPath);

              // Allow postprocessing on the css.
              css = options.postprocess.css(css, req);

              // Allow postprocessing for custom storage.
              options.storeCss(cssPath, css, next);
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

      // Compile on server restart and new files.
      if (!imports[lessPath]) {
        return compile();
      }

      // Only compile once, disregarding the file changes.
      if (options.once && imports[lessPath]) {
        return next();
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
            } else {
              return next(err);
            }
          } else if (lessStats.mtime > cssStats.mtime) {
            // Source has changed, compile it
            log('modified', cssPath);

            return compile();
          } else {
            // Check if any of the less imports were changed
            checkImports(lessPath, function(changed){
              if(typeof changed != "undefined" && changed.length) {
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
  };
};
