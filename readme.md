This middleware was created to allow processing of [Less](http://lesscss.org) files for [Connect JS](http://www.senchalabs.org/connect/) framework and by extension the [Express JS](http://expressjs.com/) framework.

[![Build Status](https://drone.io/github.com/emberfeather/less.js-middleware/status.png)](https://drone.io/github.com/emberfeather/less.js-middleware/latest)

## Installation

```sh
npm install less-middleware --save
```

## Usage

```js
lessMiddleware(source, [{options}], [{parserOptions}], [{compilerOptions}])
```

### Express

```js
var lessMiddleware = require('less-middleware');

var app = express();
app.use(lessMiddleware(__dirname + '/public'));
app.use(express.static(__dirname + '/public'));
```

### `options`

The following options can be used to control the behavior of the middleware:

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
            <th><code>debug</code></th>
            <td>Show more verbose logging?</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>dest</code></th>
            <td>Destination directory to output the compiled <code>.css</code> files.</td>
            <td>Same directory as less source files.</td>
        </tr>
        <tr>
            <th><code>force</code></th>
            <td>Always re-compile less files on each request.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>once</code></th>
            <td>Only recompile once after each server restart. Useful for reducing disk i/o on production.</td>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>pathRoot</code></th>
            <td>Common root of the source and destination. It is prepended to both the source and destination before being used.</td>
            <td><code>null</code></td>
        </tr>
        <tr>
            <th><code>postprocess</code></th>
            <td>Object containing functions relavent to preprocessing data.</td>
            <td></td>
        </tr>
        <tr>
            <th><code>postprocess.css</code></th>
            <td>Function that modifies the compiled css output before being stored.</td>
            <td><code>function(css, req){...}</code></td>
        </tr>
        <tr>
            <th><code>preprocess</code></th>
            <td>Object containing functions relavent to preprocessing data.</td>
            <td></td>
        </tr>
        <tr>
            <th><code>preprocess.less</code></th>
            <td>Function that modifies the raw less output before being parsed and compiled.</td>
            <td><code>function(src, req){...}</code></td>
        </tr>
        <tr>
            <th><code>preprocess.path</code></th>
            <td>Function that modifies the less pathname before being loaded from the filesystem.</td>
            <td><code>function(pathname, req){...}</code></td>
        </tr>
        <tr>
            <th><code>storeCss</code></th>
            <td>Function that is in charge of storing the css in the filesystem.</td>
            <td><code>function(pathname, css, next){...}</code></td>
        </tr>
    </tbody>
</table>

## `parserOptions`

The `parserOptions` are passed directly into the less parser with minimal defaults or changes by the middleware.

The following are the defaults used by the middleware:

<table>
    <thead>
        <tr>
            <th>Option</th>
            <th>Default</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th><code>dumpLineNumbers</code></th>
            <td><code>0</code></td>
        </tr>
        <tr>
            <th><code>paths</code></th>
            <td><code>[source]</code></td>
        </tr>
        <tr>
            <th><code>optimization</code></th>
            <td><code>0</code></td>
        </tr>
        <tr>
            <th><code>relativeUrls</code></th>
            <td><code>false</code></td>
        </tr>
    </tbody>
</table>

## `compilerOptions`

The `compilerOptions` are passed directly into the less parser with minimal defaults or changes by the middleware.

The following are the defaults used by the middleware:

<table>
    <thead>
        <tr>
            <th>Option</th>
            <th>Default</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th><code>compress</code></th>
            <td><code>auto</code></td>
        </tr>
        <tr>
            <th><code>sourceMap</code></th>
            <td><code>false</code></td>
        </tr>
        <tr>
            <th><code>yuicompress</code></th>
            <td><code>false</code></td>
        </tr>
    </tbody>
</table>

## Examples

Common examples of using the Less middleware are available in the [wiki](https://github.com/emberfeather/less.js-middleware/wiki/Examples).

## Extending Less

Sometimes when using less-middleware, you might want to extend less with additional custom functions for use within our stylesheets. Here's how:

1. Define `less` as a direct dependency of your project in your `package.json`, just like `less-middleware`.
1. If you've already used `npm install` to install less-middleware, you'll need to run `npm dedupe less` to consolidate down to a single copy of the library at the top level of your project. (Run `npm list less` before and after to see the difference.)
1. Now, in your app, you'll be able to extend less with additional functions:

   ```js
   var less = require('less');
   require('less-middleware');

   less.tree.functions.mycustomfunction = function() { ... };

   app.use(less.middleware(...));
   ```

1. After that, you'll be able to use your new custom function `mycustomfunction` within your less files.

## Troubleshooting

### My less never recompiles, even when I use `{force: true}`!

Make sure you're declaring less-middleware before your static middleware, if you're using the same directory, e.g. (with express):


```js
var lessMiddleware = require('less-middleware');

var app = express();
app.use(lessMiddleware(__dirname + '/public'));
app.use(express.static(__dirname + '/public'));
```

not

```js
var lessMiddleware = require('less-middleware');

var app = express();
app.use(express.static(__dirname + '/public'));
app.use(lessMiddleware(__dirname + '/public'));
```

### IIS

If you are hosting your app on IIS you will have to modify your `web.config` file in order to allow NodeJS to serve your CSS static files.  IIS will cache your CSS files, bypassing NodeJS static file serving, which in turn does not allow the middleware to recompile your LESS files.
