const path = require('path')
const fs = require('fs')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')


module.exports = {
    entry: {
        'summer-festival': './src/summer-festival/app.ts',
    },
    output: {
        filename: '[name]/index.js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    devServer: {
        host: '0.0.0.0',
        port: 8080,
        disableHostCheck: true,
        contentBase: path.resolve(__dirname, 'public'),
        publicPath: '/',
        hot: true
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'summer-festival/index.html',
            template: './public/summer-festival/index.html'
        }),
        new CleanWebpackPlugin()
    ],
    mode: 'development'
}