#!/bin/bash

source /.env

# 安装系统依赖
apt-get update && apt-get install -y build-essential python3

# 设置环境变量
export NODE_ENV=production
export NPM_CONFIG_BUILD_FROM_SOURCE=true

if [[ "$PACKAGE_MANAGER" == "npm" ]]; then
    npm config set registry $CONTAINER_PACKAGE_URL
elif [[ "$PACKAGE_MANAGER" == "yarn" ]]; then
    yarn config set registry $CONTAINER_PACKAGE_URL
elif [[ "$PACKAGE_MANAGER" == "pnpm" ]]; then
    pnpm config set registry $CONTAINER_PACKAGE_URL
fi

if [[ "$RUN_INSTALL" -eq "1" ]]; then
    # 清理现有依赖和缓存
    rm -rf node_modules
    if [[ "$PACKAGE_MANAGER" == "npm" ]]; then
        npm cache clean --force
        npm install --build-from-source
        # 验证better-sqlite3安装
        node -e "require('better-sqlite3')"
    elif [[ "$PACKAGE_MANAGER" == "yarn" ]]; then
        yarn cache clean
        yarn install --build-from-source
        node -e "require('better-sqlite3')"
    elif [[ "$PACKAGE_MANAGER" == "pnpm" ]]; then
        pnpm store prune
        pnpm install --build-from-source
        node -e "require('better-sqlite3')"
    else
        echo "未知的 PACKAGE_MANAGER: $PACKAGE_MANAGER"
        exit 1
    fi
fi

if [[ "$CUSTOM_SCRIPT" -eq "1" ]]; then
    eval $EXEC_SCRIPT
else
    if [[ "$PACKAGE_MANAGER" == "npm" ]]; then
        npm run $EXEC_SCRIPT
    elif [[ "$PACKAGE_MANAGER" == "yarn" ]]; then
        yarn run $EXEC_SCRIPT
    elif [[ "$PACKAGE_MANAGER" == "pnpm" ]]; then
        pnpm run $EXEC_SCRIPT    
    fi
fi

