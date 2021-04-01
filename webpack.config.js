const path = require('path')
const fs = require('fs')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin =  require('copy-webpack-plugin')

const entry = {}
const plugins = []

if (process.env.NODE_ENV === 'production') {
    plugins.push(new CleanWebpackPlugin())
}
const copyConfig = {
    patterns: []
}
const pages = fs.readdirSync('./src').filter(e => e !== '.DS_Store')
console.log("pages:", pages)
pages.forEach(page => {
    copyConfig.patterns.push({
        from: `src/${page}/public`,
        to: `${page}/public`
    })
})

plugins.push(new CopyWebpackPlugin(copyConfig))

pages.forEach(page => {
    entry[page] = `./src/${page}/app.ts`
    plugins.push(
        new HtmlWebpackPlugin({
            filename: `${page}/index.html`,
            template:  path.resolve(__dirname, `src/${page}/index.html`),
            chunks: [page]
        })
    )
})

module.exports = {
    entry,
    output: {
        filename: '[name]/index-[hash].js',
        path: path.resolve(__dirname, 'docs')
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    devServer: {
        host: '0.0.0.0',
        port: 8080,
        disableHostCheck: true,
        contentBase: path.resolve(__dirname, 'docs'),
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
    plugins,
    mode: process.env.NODE_ENV
}