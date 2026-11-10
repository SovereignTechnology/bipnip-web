// bipnip-web build: the RoboSats UI in self-hosted mode, written only to `dist/`.
//
// RoboSats' own `webpack.config.ts` fans its output out to sibling folders of the RoboSats monorepo
// (`../nodeapp`, `../web`, `../desktopApp`, `../android`, `../api`) and to Django templates. None of
// those exist here. This file builds the two pages bipnip's host serves, from the same entry, loaders
// and template, and leaves `webpack.config.ts` untouched so RoboSats releases merge cleanly.
//
//   dist/basic.html, dist/pro.html          (self-hosted settings: every coordinator call goes to the
//                                             page's own origin, which the bipnip host proxies)
//   dist/static/frontend/main.v<ver>.<hash>.js
//   dist/static/...                         (static assets, copied)
//
// Keep the module rules in step with `webpack.config.ts` when merging a RoboSats release.

import path from 'path';
import { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { version } from './package.json';

declare const __dirname: string;

const dist = path.resolve(__dirname, 'dist');

const page = (pro: boolean): HtmlWebpackPlugin =>
  new HtmlWebpackPlugin({
    publicPath: '/static/frontend/',
    template: path.resolve(__dirname, 'templates/frontend/index.ejs'),
    templateParameters: { pro, mobile: false },
    filename: path.resolve(dist, pro ? 'pro.html' : 'basic.html'),
    inject: 'body',
    robosatsSettings: pro ? 'selfhosted-pro' : 'selfhosted-basic',
    basePath: '/',
  });

const config = (_env: unknown, _argv: { mode: string }): Configuration => ({
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  experiments: { asyncWebAssembly: true },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  output: {
    path: path.resolve(dist, 'static/frontend'),
    filename: `main.v${version}.[contenthash].js`,
    clean: true,
    publicPath: '/static/frontend/',
  },
  plugins: [
    page(false),
    page(true),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'static'),
          to: path.resolve(dist, 'static'),
          globOptions: {
            // Build output of RoboSats' own config, and the docs that live beside the assets.
            ignore: ['**/frontend/**', '**/AGENTS.md', '**/CLAUDE.md'],
          },
        },
      ],
    }),
  ],
});

export default config;
