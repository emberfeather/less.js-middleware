This middleware was created to allow processing of [Less](http://lesscss.org) files for [Connect JS](http://www.senchalabs.org/connect/) framework and by extension the [Express JS](http://expressjs.com/) framework.

[![Build Status](https://drone.io/github.com/emberfeather/less.js-middleware/status.png)](https://drone.io/github.com/emberfeather/less.js-middleware/latest)

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

### Options

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

## Examples

Common examples of using the Less middleware are available in the [wiki](https://github.com/emberfeather/less.js-middleware/wiki/Examples).

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
