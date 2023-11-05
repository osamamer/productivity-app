const path = require('path');

module.exports = {
    entry: {
        main: path.resolve(__dirname, './js/main.js')
    },
    output: {
        path: path.resolve(__dirname, './build'),
        filename: '[name].bundle.js'
    }
}