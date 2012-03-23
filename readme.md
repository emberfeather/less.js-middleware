## Examples

### Connect

    require('less-middleware');

    var server = connect.createServer(
        less.middleware({
            src: __dirname + '/public',
            compress: true
        }),
        connect.staticProvider(__dirname + '/public')
    );

### Express

    require('less-middleware');

    var app = express.createServer();

    app.configure(function () {
        // Other configuration here...

        app.use(less.middleware({
            src: __dirname + '/public',
            compress: true
        }));

        app.use(express.staticProvider(__dirname + '/public'));
    });
