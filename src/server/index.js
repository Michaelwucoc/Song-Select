const express = require('express');
const session = require('express-session');
const path = require('path');
const Database = require('better-sqlite3');
const SpotifyWebApi = require('spotify-web-api-node');
const EpayService = require('./epay');
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
    priority INTEGER DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    payment_amount DECIMAL(10,2) DEFAULT 5.00,
    payment_time DATETIME,
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
  const { chinese_name, english_name, song_name, artist, cover_url, spotify_id, priority } = req.body;
  
  try {
    const stmt = db.prepare('INSERT INTO songs (chinese_name, english_name, song_name, artist, cover_url, spotify_id, priority) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(chinese_name, english_name, song_name, artist, cover_url, spotify_id, priority || 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '保存点歌记录失败' });
  }
});

// 初始化易支付服务
const epayService = new EpayService(
  process.env.EPAY_MERCHANT_ID,
  process.env.EPAY_MERCHANT_KEY,
  process.env.EPAY_API_URL
);

// 支付相关路由
app.post('/api/songs/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { payType } = req.body;  // 确保从请求体中获取支付类型
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // 验证支付方式
  if (!payType || !Object.values(EpayService.PAYMENT_TYPES).includes(payType)) {
    return res.status(400).json({ error: '无效的支付方式' });
  }

  try {
    const song = db.prepare('SELECT song_name, payment_amount FROM songs WHERE id = ?').get(id);
    if (!song) {
      return res.status(404).json({ error: '未找到该歌曲' });
    }
    
    const orderId = `song_${id}_${Date.now()}`;
    const formHtml = await epayService.createPaymentOrder(
      orderId, 
      song.payment_amount, 
      song.song_name,
      payType,  // 确保传递正确的支付类型
      clientIp
    );
    
    res.send(formHtml);
  } catch (error) {
    console.error('创建支付订单失败:', error);
    res.status(500).json({ error: '创建支付订单失败' });
  }
});

// 支付异步通知
app.all('/api/epay/notify', async (req, res) => {
  const params = { ...req.query, ...req.body };
  
  console.log('收到支付回调:', params);
  
  // 验证签名
  if (!epayService.verifyNotify(params)) {
    console.error('签名验证失败');
    return res.status(400).send('fail');
  }

  // 验证支付状态
  if (params.trade_status !== 'TRADE_SUCCESS') {
    console.error('支付未成功');
    return res.status(400).send('fail');
  }

  try {
    const orderId = params.out_trade_no;
    const songId = orderId.split('_')[1];
    
    // 更新支付状态
    const stmt = db.prepare(`
      UPDATE songs 
      SET payment_status = ?, 
          payment_amount = ?, 
          payment_time = CURRENT_TIMESTAMP,
          priority = 1 
      WHERE id = ?
    `);
    
    const result = stmt.run('paid', params.money, songId);
    console.log('更新支付状态:', result);

    res.send('success');
  } catch (error) {
    console.error('处理支付回调失败:', error);
    res.status(500).send('fail');
  }
});

// 支付页面跳转通知
app.get('/api/epay/return', (req, res) => {
  const params = req.query;
  
  console.log('收到支付页面跳转通知:', params);
  
  if (!epayService.verifyNotify(params)) {
    return res.redirect('/songs?payment=failed');
  }

  if (params.trade_status !== 'TRADE_SUCCESS') {
    return res.redirect('/songs?payment=failed');
  }

  return res.redirect('/songs?payment=success');
});

// 添加支付状态缓存
const paymentStatusCache = new Map();

// 支付状态查询接口
app.get('/api/songs/:id/payment-status', async (req, res) => {
  const { id } = req.params;
  
  try {
    // 检查缓存
    const cachedStatus = paymentStatusCache.get(id);
    if (cachedStatus) {
      return res.json({ status: cachedStatus });
    }

    const song = db.prepare('SELECT payment_status FROM songs WHERE id = ?').get(id);
    if (!song) {
      return res.status(404).json({ error: '未找到该歌曲' });
    }

    // 如果状态是已支付，则缓存结果
    if (song.payment_status === 'paid') {
      paymentStatusCache.set(id, song.payment_status);
    }

    res.json({ status: song.payment_status });
  } catch (error) {
    console.error('查询支付状态失败:', error);
    res.status(500).json({ error: '查询支付状态失败' });
  }
});

// 在支付成功回调中更新缓存
app.all('/api/epay/notify', async (req, res) => {
  const params = { ...req.query, ...req.body };
  
  console.log('收到支付回调:', params);
  
  // 验证签名
  if (!epayService.verifyNotify(params)) {
    console.error('签名验证失败');
    return res.status(400).send('fail');
  }

  // 验证支付状态
  if (params.trade_status !== 'TRADE_SUCCESS') {
    console.error('支付未成功');
    return res.status(400).send('fail');
  }

  try {
    const orderId = params.out_trade_no;
    const songId = orderId.split('_')[1];
    
    // 更新支付状态
    const stmt = db.prepare(`
      UPDATE songs 
      SET payment_status = ?, 
          payment_amount = ?, 
          payment_time = CURRENT_TIMESTAMP,
          priority = 1 
      WHERE id = ?
    `);
    
    const result = stmt.run('paid', params.money, songId);
    
    // 更新缓存
    paymentStatusCache.set(songId, 'paid');
    
    console.log('更新支付状态:', result);
    res.send('success');
  } catch (error) {
    console.error('处理支付回调失败:', error);
    res.status(500).send('fail');
  }
});

// 添加GET路由处理易支付的return_url回调
app.get('/api/epay/notify', (req, res) => {
  const params = req.query;
  
  console.log('收到支付页面跳转通知:', params);
  
  if (!epayService.verifyNotify(params)) {
    return res.redirect('/songs?payment=failed');
  }

  try {
    const orderId = params.out_trade_no;
    const songId = orderId.split('_')[1];
    const stmt = db.prepare('UPDATE songs SET payment_status = ?, payment_amount = ?, payment_time = CURRENT_TIMESTAMP, priority = 1 WHERE id = ?');
    stmt.run('paid', params.money, songId);
    return res.redirect('/songs?payment=success');
  } catch (error) {
    console.error('处理支付跳转通知失败:', error);
    return res.redirect('/songs?payment=error');
  }
});

app.get('/api/songs/payment/:id', (req, res) => {
  const { id } = req.params;
  try {
    const song = db.prepare('SELECT payment_status, payment_amount FROM songs WHERE id = ?').get(id);
    if (!song) {
      return res.status(404).json({ error: '未找到该歌曲' });
    }
    res.json(song);
  } catch (error) {
    res.status(500).json({ error: '获取支付状态失败' });
  }
});

app.get('/api/songs', (req, res) => {
  try {
    const songs = db.prepare('SELECT * FROM songs ORDER BY priority DESC, created_at DESC').all();
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


// 添加优先级设置接口
app.post('/api/songs/:id/priority', (req, res) => {
  const { id } = req.params;
  const { admin_password, priority } = req.body;

  if (admin_password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: '管理员密码错误' });
  }

  try {
    const stmt = db.prepare('UPDATE songs SET priority = ? WHERE id = ?');
    stmt.run(priority, id);
    res.json({ success: true });
  } catch (error) {
    console.error('设置优先级失败:', error);
    res.status(500).json({ error: '设置优先级失败' });
  }
});