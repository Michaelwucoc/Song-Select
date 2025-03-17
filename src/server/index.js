const express = require('express');
const session = require('express-session');
const path = require('path');
const Database = require('better-sqlite3');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const app = express();
const db = new Database(process.env.SQLITE_PATH);

// 初始化数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chinese_name TEXT NOT NULL,
    english_name TEXT NOT NULL,
    song_name TEXT NOT NULL,
    artist TEXT NOT NULL,
    cover_url TEXT,
    spotify_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 配置中间件
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// 配置Spotify API客户端
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/callback'
});

// 添加错误处理中间件
app.use((err, req, res, next) => {
  console.error('API错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 获取和刷新Spotify访问令牌
async function refreshSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    // 在令牌过期前自动刷新
    setTimeout(refreshSpotifyToken, (data.body.expires_in - 60) * 1000);
  } catch (error) {
    console.error('获取Spotify访问令牌失败:', error);
  }
}

// 初始化Spotify令牌
refreshSpotifyToken();

// API路由
app.post('/api/songs', async (req, res) => {
  const { song_name, spotify_id } = req.body;

  try {
    let data;
    if (spotify_id) {
      // 通过ID获取歌曲
      data = await spotifyApi.getTrack(spotify_id);
      res.json([data.body]);
    } else if (song_name) {
      // 搜索Spotify歌曲
      data = await spotifyApi.searchTracks(song_name);
      res.json(data.body.tracks.items);
    } else {
      res.status(400).json({ error: '请提供歌曲名称或Spotify ID' });
    }
  } catch (error) {
    console.error('Spotify API错误:', error);
    res.status(500).json({ error: error.message || '获取歌曲信息失败' });
  }
});

app.post('/api/songs/submit', (req, res) => {
  const { chinese_name, english_name, song_name, artist, cover_url, spotify_id } = req.body;
  
  try {
    const stmt = db.prepare('INSERT INTO songs (chinese_name, english_name, song_name, artist, cover_url, spotify_id) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(chinese_name, english_name, song_name, artist, cover_url, spotify_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '保存点歌记录失败' });
  }
});

app.get('/api/songs', (req, res) => {
  try {
    const songs = db.prepare('SELECT * FROM songs ORDER BY created_at DESC').all();
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: '获取点歌列表失败' });
  }
});

app.post('/api/songs/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, admin_password } = req.body;

  if (admin_password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: '管理员密码错误' });
  }

  try {
    const stmt = db.prepare('UPDATE songs SET status = ? WHERE id = ?');
    stmt.run(status, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新歌曲状态失败' });
  }
});

app.delete('/api/songs/:id', (req, res) => {
  const { id } = req.params;
  const { admin_password } = req.body;

  if (admin_password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: '管理员密码错误' });
  }

  try {
    const stmt = db.prepare('DELETE FROM songs WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除歌曲失败' });
  }
});

// 在生产环境中服务静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
} else {
  // 在开发环境中处理所有路由
  app.get('*', (req, res) => {
    res.redirect('http://localhost:5173' + req.url);
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});