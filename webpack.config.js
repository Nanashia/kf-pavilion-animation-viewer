const webpack = require('webpack');

module.exports = [
    {
        // メインとなるJavaScriptファイル（エントリーポイント）
        entry: `./src/index.js`,

        output: {
            //  出力ファイルのディレクトリ名
            path: `${__dirname}/dist`,
            // 出力ファイル名
            filename: 'index.js'
        },
        // モード値を production に設定すると最適化された状態で、
        // development に設定するとソースマップ有効でJSファイルが出力される
        mode: "development",
        devServer: {
            static: ["dist"],
            open: true
        },
        devtool: "eval-source-map",
        plugins: [
            // THREE.Scene などの形式で three.js のオブジェクトを使用できるようにする
            new webpack.ProvidePlugin({
                THREE : 'three/build/three'
            }),
        ]
    },
];
