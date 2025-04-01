const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
	entry: './src/index.ts',
	mode: 'production',
	target: 'node',
	stats: 'summary',
	output: {
		filename: './index.js',
		path: path.resolve(__dirname, './'),
		libraryTarget: 'umd',
		globalObject: 'this'
	},
	resolve: {
		extensions: ['.ts', '.js']
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				extractComments: false,
			}),
		],
	},
};