# 使用Node.js官方镜像作为基础镜像
FROM node:18

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && \
    apt-get install -y build-essential python3 && \
    apt-get clean

# 复制package.json和package-lock.json
COPY package*.json ./

# 设置环境变量并安装依赖
ENV NODE_ENV=production
ENV NPM_CONFIG_BUILD_FROM_SOURCE=true
RUN npm install --build-from-source

# 验证better-sqlite3安装
RUN node -e "require('better-sqlite3')"

# 复制其余项目文件
COPY . .

# 构建前端代码
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]