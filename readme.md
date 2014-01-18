## Installation

    sudo npm install less-middleware

## Options

<table>
    <thead>
        <tr>
            <th>Option</th>
            <th>Description</th>
            <th>Default</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th><code>force</code></th>
            <td>Always re-compile less files on each request.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>once</code></th>
            <td>Only check for need to recompile once after each server restart. Useful for reducing disk i/o on production.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>debug</code></th>
            <td>Output any debugging messages to the console.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>src</code></th>
            <td>Source directory containing the <code>.less</code> files. <strong>Required.</strong></td>
            <td></td>
        </tr>
        <tr>
            <th><code>dest</code></th>
            <td>Desitnation directory to output the compiled <code>.css</code> files.</td>
            <td><code>&lt;src&gt;</code></td>
        </tr>
        <tr>
            <th><code>paths</code></th>
            <td>Specify search paths for <code>@import</code> directives</td>
            <td>The <code>dirname</code> of <code>&lt;src&gt;</code></td>
        </tr>
        <tr>
            <th><code>prefix</code></th>
            <td>Path which should be stripped from the public <code>pathname</code>.</td>
            <td></td>
        </tr>
        <tr>
            <th><code>compress</code></th>
            <td>Compress the output being written to the <code>*.css</code> files. When set to <code>'auto'</code> compression will only happen when the css file ends with <code>.min.css</code> or <code>-min.css</code>.</td>
            <td><code>auto</code></td>
        </tr>
        <tr>
            <th><code>yuicompress</code></th>
            <td>More involved minification with <a href="http://yui.github.io/yuicompressor/css.html">YUI compression</a></td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>optimization</code></th>
            <td>Desired level of LESS optimization. Optionally <code>0</code>, <code>1</code>, or <code>2</code></td>
            <td><code>0</code></td>
        </tr>
        <tr>
            <th><code>dumpLineNumbers</code></th>
            <td>Add line tracking to the compiled css. Optionally <code>0</code>, <code>'comments'</code>, or <code>'mediaquery'</code></td>
            <td><code>0</code></td>
        </tr>
        <tr>
            <th><code>relativeUrls</code></th>
            <td>Adjust urls to be relative to directory of files imported with @import. If false, urls will remain unchanged.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>sourceMap</code></th>
            <td>Enable sourcemap support. You can compile your less and then use developer tools to see where in your less file a particular piece of css comes from.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>preprocessor</code></th>
            <td>Specify a preprocessing function applied to LESS source code before parsing. The function will receive the LESS source code and the Connect request object as parameters, and must return the modified source code.</td>
            <td></td>
        </tr>
         <tr>
            <th><code>treeFunctions</code></th>
            <td>Object with custom functions added to <code>less.tree.functions</code>.</td>
            <td></td>
        </tr>
    </tbody>
</table>

## Examples

### Connect
```js
var lessMiddleware = require('less-middleware');

var server = connect.createServer(
    lessMiddleware({
        src: __dirname + '/public',
        compress: true
    }),
    connect.staticProvider(__dirname + '/public')
);
```

### Express

```js
var lessMiddleware = require('less-middleware');

var app = express();

app.configure(function () {
    // Other configuration here...

    app.use(lessMiddleware({
        src: __dirname + '/public',
        compress: true
    }));

    app.use(express.static(__dirname + '/public'));
});
```

### Express - Different `src` and `dest`

When using a different `src` and `dest` you can use the `prefix` option to make the directory structure cleaner.

Requests for static assets (like stylesheets) made to the express server use a `pathname` to look up the file. So if the request is for `http://localhost/stylesheets/styles.css` the `pathname` will be `/stylesheets/styles.css`.

The less middleware uses that path to determine where to look for less files. In the original example it looks for the less file at `/public/stylesheets/styles.less` and compiles it to `/public/stylesheets/styles.css`.

If you are using a different `src` and `dest` options it causes for more complex directories structures unless you use the `prefix` option. For example, without the `prefix`, and with a `src` of `/src/less` and a `dest` of `/public` it would look for the less file at `/src/less/stylesheets/styles.less` and compile it to `/public/stylesheets/styles.css`. To make it cleaner you can use the `prefix` option:

```js
var lessMiddleware = require('less-middleware');

var app = express();

app.configure(function () {
    // Other configuration here...

    app.use(lessMiddleware({
        dest: __dirname + '/public/stylesheets',
        src: __dirname + '/src/less',
        prefix: '/stylesheets',
        compress: true
    }));

    app.use(express.static(__dirname + '/public'));
});
```

Using the `prefix` it changes the `pathname` from `/stylesheets/styles.css` to `/styles.css`. With that prefix removed from the `pathname` it makes things cleaner. With the `prefix` removed it would look for the less file at `/src/less/styles.less` and compile it to `/public/stylesheets/styles.css`.

A new alternative way to achieve the same thing as using prefix but with greater flexibility is to supply a shared root value. From this shared root, you would specify a URI style path to the appropriate source and destination directories:

```js
var lessMiddleware = require('less-middleware')
  , path = require('path')
  , pubDir = path.join(__dirname, 'public')
  , app = express();
  
app.configure(function() {
    app.use(lessMiddleware({
        dest: '/css', // should be the URI to your css directory from the location bar in your browser
        src: '/less', // or '../less' if the less directory is outside of /public
        root: pubDir,
        compress: true
    }));
    
    app.use(express.static(pubDir));
});
```

This will allow any file under the /less directory, including subdirectories, to be compiled into an identical directory structure under /css.

### Express - Using a temp directory for `dest`

Since less middleware relies on static content to be served by express.static, using temp directories just requires that you inform express about where generated files are built:

```js
var lessMiddleware = require('less-middleware'),
    os = require('os');

var app = express();

app.configure(function () {
    // Other configuration here...

    var tmpDir = os.tmpDir();
    app.use(lessMiddleware({
        src: __dirname + '/public/stylesheets',
        dest: tmpDir,
        compress: true
    }));

    app.use(express.static(__dirname + '/public'));
    app.use(express.static(tmpDir));
});
```

Using a temp directory is useful for read-only file systems, such as a Heroku deployment. By using a temp directory the css files can still be written and served.

### Importing less

By default the directory in which the compiled files live in is already set as an import directive:

```css
// file1.less

@import 'file2.less';

body {
  color: @bodyColor;
}
```

```css
// file2.less

@bodyColor: #333333;
```

However, you can use the `paths` option if you need to specify other directories in which to search for importable less files.

```js
var less = require('less-middleware'),
    path = require('path');

    lessMiddleware({
        src: path.join(__dirname, 'public'),
        paths: [path.join(__dirname, 'module', 'less')]
    });
```

```css
// public/base.css

@import 'colors';

body {
  color: @bodyColor;
}
```

```css
// module/less/colors.less

@bodyColor: #333333;
```

### Using bootstrap

Here's an example on how to use Twitter's bootstrap within an Express.js set-up:

```js
// package.json
{
  "name": "my-module",
  // ...
  "dependencies": {
    "less-middleware": "*",
    "bootstrap": "git+https://github.com/twitter/bootstrap.git#v2.2.2",
    "express": "3.0"
  }
}
```

```js
// app.js
var express  = require('express')
  , path     = require('path')
  , app      = express()
  , less     = require('less-middleware');

app.configure(function(){
  // ...
  var bootstrapPath = path.join(__dirname, 'node_modules', 'bootstrap');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use('/img', express['static'](path.join(bootstrapPath, 'img')));
  app.use(app.router);
  app.use(less({
    src    : path.join(__dirname, 'assets', 'less'),
    paths  : [path.join(bootstrapPath, 'less')],
    dest   : path.join(__dirname, 'public', 'stylesheets'),
    prefix : '/stylesheets'
  }));
  app.use(express['static'](path.join(__dirname, 'public')));
  // ...
});

// ...
```

```css
// assets/less/base.less

@import 'bootstrap';
@import 'responsive';

@bodyBackground: #FAF7EC;
@navbarBrandColor: #989CAE;

.brand {
  font-family: @monoFontFamily;
}
```

### Preprocessing

```js
var lessMiddleware = require('less-middleware');

var app = express();

app.configure(function () {
    // Other configuration here...

    app.use(lessMiddleware({
        src: __dirname + '/public',
        preprocessor: function(src, req) {
            if (req.param("namespace")) {
                src = req.param("namespace") + " { " + src + " }";
            }
            
            return src;
        },
        compress: true
    }));

    app.use(express.static(__dirname + '/public'));
});
```

## Troubleshooting

### My less never recompiles, even when I use `{force: true}`!
Make sure you're declaring less-middleware before your static middleware, if you're using the same directory, e.g. (with express):
```js
app.use(require('less-middleware')({ src: __dirname + '/public', debug: true }));
app.use(express.static(path.join(__dirname, 'public')));
```
not
```js
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('less-middleware')({ src: __dirname + '/public', debug: true }));
```

### IIS
If you are hosting your app on IIS you will have to modify your `web.config` file in order to allow NodeJS to serve your CSS static files.  IIS will cache your CSS files, bypassing NodeJS static file serving, which in turn does not allow the middleware to recompile your LESS files.
