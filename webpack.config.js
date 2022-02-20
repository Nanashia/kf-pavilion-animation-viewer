const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

const config = [
    {
        // メインとなるJavaScriptファイル（エントリーポイント）
        entry: `./src/index.js`,

        output: {
            //  出力ファイルのディレクトリ名
            path: `${__dirname}/dist`,
            // 出力ファイル名
            filename: 'index.js'
        },
        devServer: {
            static: ["dist"],
            open: true
        },
    },
];

module.exports = (env, argv) => {
    if (argv.mode === 'development') {
      config.devtool = 'eval-source-map';
    }
  
    if (argv.mode === 'production') {
    }
  
    return config;
  };