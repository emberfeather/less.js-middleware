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
var url = require('url');
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
module.exports = less.middleware = function(src, options, parserOptions, compilerOptions){
  // Source dir is required.
  if (!src) { throw new Error('less.middleware() requires `src` directory'); }

  // Override the defaults for the middleware.
  options = extend(true, {
    once: false,
    debug: false,
    paths: [],
    postprocess: {
      css: function(css, req) { return css; }
    },
    preprocess: {
      less: function(src, req) { return src; },
      path: function(pathname, req) { return pathname; }
    },
    root: null,
    treeFunctions: {},
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

  // Default dest dir to output generated files.
  var dest = options.dest ? options.dest : src;

  // Force paths to be an array.
  if (!(options.paths instanceof Array)) {
    options.paths = [options.paths];
  }

  // Add tree functions to the less library if provided.
  extend(less.tree.functions, options.treeFunctions);

  // Parse and compile the CSS from the source string.
  var render = function(str, lessPath, cssPath, callback) {
    var paths = [ path.dirname(lessPath) ];
    options.paths.forEach(function(p){ paths.push(p); });

    var parser = new less.Parser(extend({}, parserOptions, {
      paths: paths,
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

        // Store the less import paths
        imports[lessPath] = determine_imports(tree, lessPath, options.paths);

        callback(err, css);
      } catch(parseError) {
        callback(parseError, null);
      }
    });
  };

  // Middleware
  return function(req, res, next) {
    if ('GET' != req.method.toUpperCase() && 'HEAD' != req.method.toUpperCase()) { return next(); }

    var pathname = url.parse(req.url).pathname;

    // Only handle the matching files
    if (utilities.isValidPath(pathname)) {
      if (options.prefix && 0 === pathname.indexOf(options.prefix)) {
        pathname = pathname.substring(options.prefix.length);
      }

      var cssPath = path.join(dest, pathname);
      var lessPath = path.join(src, utilities.maybeCompressedSource(pathname));

      if (options.root) {
        cssPath = path.join(options.root, dest, pathname.replace(dest, ''));
        lessPath = path.join(options.root, src, pathname
            .replace(dest, '')
            .replace('.css', '.less'));
      }

      // Allow for preprocessing the source filename.
      lessPath = options.preprocess.path(lessPath, req);

      log('source', lessPath);
      log('dest', cssPath);
      
      // Ignore ENOENT to fall through as 404
      var error = function(err) {
        return next('ENOENT' == err.code ? null : err);
      };

      // Compile to cssPath
      var compile = function() {
        log('read', lessPath);

        fs.readFile(lessPath, 'utf8', function(err, lessSrc){
          if (err) { return error(err); }

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

      // Force
      if (options.force) { return compile(); }

      // Re-compile on server restart, disregarding
      // mtimes since we need to map imports
      if (!imports[lessPath]) { return compile(); }

      // Only check/recompile if it has not been done at before
      if (options.once && imports[lessPath]) { return next(); }

      // Compare mtimes
      fs.stat(lessPath, function(err, lessStats){
        if (err) { return error(err); }

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
