## Installation

    sudo npm install less-middleware

## Examples

### Connect

    var lessMiddleware = require('less-middleware');

    var server = connect.createServer(
        lessMiddleware({
            src: __dirname + '/public',
            compress: true
        }),
        connect.staticProvider(__dirname + '/public')
    );

### Express

    var lessMiddleware = require('less-middleware');

    var app = express.createServer();

    app.configure(function () {
        // Other configuration here...

        app.use(lessMiddleware({
            src: __dirname + '/public',
            compress: true
        }));

        app.use(express.staticProvider(__dirname + '/public'));
    });
