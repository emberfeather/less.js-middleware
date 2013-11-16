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
    options, parserOptions, toCSSOptions, sourceMapFileInline = false,
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

// Borrowed from less.js/bin/lessc
function ensureDirectory(filepath) {
    var dir = path.dirname(filepath),
        cmd,
        existsSync = fs.existsSync || path.existsSync;
    if (!existsSync(dir)) {
        if (mkdirp === undefined) {
            try {mkdirp = require('mkdirp');}
            catch(e) { mkdirp = null; }
        }
        cmd = mkdirp && mkdirp.sync || fs.mkdirSync;
        cmd(dir);
    }
};

function parseOptions(config) {

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
  root = typeof config.root === 'string' ? config.root : false;

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

  // from less.js/bin/lessc
  options = {
    //depends: false,
    compress: false,
    cleancss: false,
    //max_line_len: -1,
    optimization: 1,
    //silent: false,
    //verbose: false,
    //lint: false,
    paths: [],
    //color: true,
    strictImports: false,
    insecure: false,
    rootpath: '',
    relativeUrls: false,
    ieCompat: true,
    strictMath: false,
    strictUnits: false
  };

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
  if (config.yuicompress) {
    log("Warning", "yui-compress option has been removed. assuming clean-css.", 'warn')
    options.cleancss = true;
  }
  if (config.cleancss) options.cleancss = true;

  // Optimization option
  options.optimization = config.optimization || 0;

  if (config.strictImports) options.strictImports = true;
  if (config.insecure) options.insecure = true;

  // Relative paths?
  options.relativeUrls = config.relativeUrls || false;

  if (!config.ieCompat) options.ieCompat = false;
  if (config.strictMath) options.strictMath = true;
  if (config.strictUnits) options.strictUnits = true;

  // Line Number Tracking
  options.dumpLineNumbers = config.dumpLineNumbers || 0;

  // Source map
  options.sourceMap = config.sourceMap || false;
  if (config.sourceMapRootpath) options.sourceMapRootpath = config.sourceMapRootpath;
  if (config.sourceMapBasepath) options.sourceMapBasepath = config.sourceMapBasepath;
  if (config.sourceMapFileInline) {
    sourceMapFileInline = true;
    options.sourceMap = true
  }
  if (config.outputSourceFiles) options.outputSourceFiles = true;

  if (config.rootpath) options.rootpath = config.rootpath.replace(/\\/g, '/');

  if (config.javascriptEnabled === false)  options.javascriptEnabled = false
}

function parseCSSOptions(input, output) {

  // from less.js/bin/lessc

  input = path.resolve(process.cwd(), input);
  if (output) {
      options.sourceMapOutputFilename = output;
      output = path.resolve(process.cwd(), output);
  }

  options.sourceMapBasepath = options.sourceMapBasepath || (input ? path.dirname(input) : process.cwd());

  if (options.sourceMap === true) {
      if (!output && !sourceMapFileInline) {
          console.log("the sourcemap option only has an optional filename if the css filename is given");
          return;
      }
      options.sourceMapFullFilename = options.sourceMapOutputFilename + ".map";
      options.sourceMap = path.basename(options.sourceMapFullFilename);
  }

  if (!sourceMapFileInline) {
      var writeSourceMap = function(output) {
          var filename = options.sourceMapFullFilename || options.sourceMap;
          ensureDirectory(filename);
          fs.writeFileSync(filename, output, 'utf8');
      };
  }

  toCSSOptions = {
    silent: options.silent,
    verbose: options.verbose,
    ieCompat: options.ieCompat,
    compress: options.compress,
    cleancss: options.cleancss,
    sourceMap: Boolean(options.sourceMap),
    sourceMapFilename: options.sourceMap,
    sourceMapOutputFilename: options.sourceMapOutputFilename,
    sourceMapBasepath: options.sourceMapBasepath,
    sourceMapRootpath: options.sourceMapRootpath || "",
    outputSourceFiles: options.outputSourceFiles,
    writeSourceMap: writeSourceMap,
    maxLineLen: options.maxLineLen,
    strictMath: options.strictMath,
    strictUnits: options.strictUnits
  }
}

function defaultRender(str, lessPath, cssPath, callback) {

  var paths = [ path.dirname(lessPath) ];
  defaultPaths.forEach(function(p) { paths.push(p); });

  options.paths = paths;
  options.filename = lessPath;

  parseCSSOptions(lessPath, cssPath)
  toCSSOptions.compress = (options.compress == 'auto' ? regex.compress.test(cssPath) : options.compress)

  var parser = new less.Parser(options);

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

      var cssPath, lessPath,
          cssext = regex.compress.test(pathname) ? '.min.css' : '.css';


      if (root) {
        cssPath = path.join(root, dest, pathname.replace(dest, ''));
        lessPath = path.join(root, src, pathname.replace(dest, '').replace(cssext, '.less'));
      } else {
        cssPath = path.join(dest, pathname);
        lessPath = path.join(src, pathname.replace(cssext, '.less'));
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

    // Ignore ENOENT to fall through as 404
    function error(err) {
      return next('ENOENT' == err.code ? null : err);
    };
  };
};
