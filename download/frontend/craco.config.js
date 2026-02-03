// craco.config.js
const path = require("path");
require("dotenv").config();

const isDevServer = process.env.NODE_ENV !== "production";

const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: false, // Disabled - plugins don't exist
};

let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  try {
    setupDevServer = require("./plugins/visual-edits/dev-server-setup");
    babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  } catch (e) {
    config.enableVisualEdits = false;
  }
}

let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  try {
    WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
    setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
    healthPluginInstance = new WebpackHealthPlugin();
  } catch (e) {
    config.enableHealthCheck = false;
  }
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/public/**',
        ],
      };

      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }
      setupHealthEndpoints(devServer, healthPluginInstance);
      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
