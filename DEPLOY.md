# 点歌系统部署指南

## 1. 服务器环境准备

### 1.1 安装 Node.js
```bash
# 使用 nvm 安装 Node.js (必须使用 LTS 版本，推荐 v18.x)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### 1.2 安装必要的系统依赖
```bash
sudo apt update
sudo apt install -y sqlite3 build-essential python3
```

## 2. 项目部署

### 2.1 克隆代码
```bash
git clone <你的代码仓库地址>
cd song-select
```

### 2.2 安装依赖

#### 2.2.1 标准安装
```bash
npm install
```

#### 2.2.2 Docker环境下的安装
如果在Docker容器中运行，需要特别注意better-sqlite3模块的安装和编译。请按照以下步骤操作：

1. 确保容器中已安装build-essential和python3：
```bash
apt-get update && apt-get install -y build-essential python3
```

2. 清理并重新安装依赖：
```bash
# 删除node_modules目录
rm -rf node_modules

# 清理npm缓存
npm cache clean --force

# 安装所有依赖，同时重新编译better-sqlite3
NODE_ENV=production npm install --build-from-source

# 验证better-sqlite3安装
node -e "require('better-sqlite3')"
```

如果在验证步骤中出现错误，可以尝试单独重新编译better-sqlite3：
```bash
# 删除现有的better-sqlite3模块
rm -rf node_modules/better-sqlite3

# 重新安装并编译better-sqlite3
NPM_CONFIG_BUILD_FROM_SOURCE=true npm install better-sqlite3
```

### 2.3 配置环境变量
创建 .env 文件并配置以下变量：
```env
PORT=3000
SESSION_SECRET=<你的session密钥>
SQLITE_PATH=./database.sqlite
SPOTIFY_CLIENT_ID=<你的Spotify客户端ID>
SPOTIFY_CLIENT_SECRET=<你的Spotify客户端密钥>
ADMIN_PASSWORD=<管理员密码>
```

### 2.4 构建前端代码
```bash
npm run build
```

## 3. 使用 PM2 管理进程

### 3.1 安装 PM2
```bash
npm install -g pm2
```

### 3.2 创建 PM2 配置文件
创建 ecosystem.config.js：
```javascript
module.exports = {
  apps: [{
    name: 'song-select',
    script: 'src/server/index.js',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log'
  }]
};
```

### 3.3 启动服务
```bash
pm2 start ecosystem.config.js
```

## 4. Nginx 反向代理配置

### 4.1 安装 Nginx
```bash
sudo apt install nginx
```

### 4.2 配置 Nginx
创建 /etc/nginx/sites-available/song-select：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.3 启用站点
```bash
sudo ln -s /etc/nginx/sites-available/song-select /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL 证书配置（可选）

### 5.1 安装 Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

### 5.2 获取并配置 SSL 证书
```bash
sudo certbot --nginx -d your-domain.com
```

## 6. 维护

### 6.1 查看日志
```bash
pm2 logs song-select
```

### 6.2 更新代码
```bash
git pull
npm install
npm run build
pm2 restart song-select
```

### 6.3 监控
```bash
pm2 monit
```

## 7. 故障排查

- 检查日志文件：`logs/error.log` 和 `logs/out.log`
- 检查 Node.js 进程状态：`pm2 status`
- 检查 Nginx 状态：`sudo systemctl status nginx`
- 检查防火墙配置：确保端口 80 和 443（如果使用 HTTPS）已开放

## 8. 安全建议

1. 定期更新系统和依赖包
2. 使用强密码作为管理员密码
3. 配置防火墙，只开放必要端口
4. 启用 HTTPS
5. 定期备份数据库

## 9. 备份策略

### 9.1 数据库备份
创建定时备份脚本 backup.sh：
```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATETIME=$(date +"%Y%m%d_%H%M%S")

# 备份数据库
cp database.sqlite "$BACKUP_DIR/database_$DATETIME.sqlite"

# 保留最近30天的备份
find "$BACKUP_DIR" -name "database_*.sqlite" -mtime +30 -delete
```

添加到 crontab：
```bash
0 0 * * * /path/to/backup.sh
```