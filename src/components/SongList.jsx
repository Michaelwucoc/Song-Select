import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function SongList() {
  const [songs, setSongs] = useState([]);
  const [error, setError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPlayed, setShowPlayed] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(null);

  // 处理支付方式选择
  const handlePaymentSelect = async (songId, payType) => {
    setShowPaymentModal(false);
    setSelectedSongId(null);
    
    try {
      const response = await fetch(`/api/songs/${songId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          payType: payType === 'wxpay' ? 'wxpay' : 'alipay'
        })
      });
      
      if (!response.ok) {
        throw new Error('创建支付订单失败');
      }
      
      const formHtml = await response.text();
      
      // 创建新窗口并打开支付页面
      const payWindow = window.open('', '_blank');
      payWindow.document.write(formHtml);
      payWindow.document.close();
      
      // 每5秒检查一次支付状态
      const checkInterval = setInterval(async () => {
        const statusResponse = await fetch(`/api/songs/${songId}/payment-status`);
        const data = await statusResponse.json();
        if (data.status === 'paid') {
          clearInterval(checkInterval);
          fetchSongs();
        }
      }, 5000);

      // 3分钟后停止检查
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 180000); // 改为3分钟
    } catch (err) {
      setError(err.message || '支付失败');
    }
  };

  // 删除其他重复的支付处理函数
  // 删除 handlePayment 和 handlePaymentProcess
  // 支付方式选择模态框
  const PaymentModal = ({ show, onClose, songId }) => {
    if (!show) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <h3 className="text-xl font-bold mb-4">选择支付方式</h3>
          <div className="flex gap-4">
            <button
              onClick={() => handlePaymentSelect(songId, 'alipay')}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              支付宝支付
            </button>
            <button
              onClick={() => handlePaymentSelect(songId, 'wxpay')}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              微信支付
            </button>
          </div>
          <button
            onClick={onClose}
            className="mt-4 text-gray-600 hover:text-gray-800"
          >
            取消
          </button>
        </div>
      </div>
    );
  };

  // 修改支付按钮点击处理
  const handlePaymentClick = (songId) => {
    setSelectedSongId(songId);
    setShowPaymentModal(true);
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      const response = await fetch('/api/songs');
      if (!response.ok) {
        throw new Error('获取点歌列表失败');
      }
      const data = await response.json();
      setSongs(data);
    } catch (err) {
      setError(err.message || '获取点歌列表失败');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (!adminPassword) {
      setError('请输入管理员密码');
      return;
    }

    try {
      const response = await fetch(`/api/songs/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          admin_password: adminPassword
        })
      });

      if (!response.ok) {
        throw new Error('更新状态失败');
      }

      fetchSongs();
      setError('');
    } catch (err) {
      setError(err.message || '更新状态失败');
    }
  };

  const handleDelete = async (id) => {
    if (!adminPassword) {
      setError('请输入管理员密码');
      return;
    }

    if (!window.confirm('确定要删除这条点歌记录吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/songs/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_password: adminPassword
        })
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      fetchSongs();
      setError('');
    } catch (err) {
      setError(err.message || '删除失败');
    }
  };

  // 添加支付状态检查函数
  const checkPaymentStatus = async (songId) => {
    try {
      const response = await fetch(`/api/songs/${songId}/payment-status`);
      if (!response.ok) {
        throw new Error('查询支付状态失败');
      }
      const data = await response.json();
      if (data.status === 'paid') {
        // 刷新歌曲列表
        fetchSongs();
      }
    } catch (err) {
      console.error('查询支付状态失败:', err);
    }
  };

  // 在支付按钮点击处理函数中添加状态检查
  // 删除重复声明的handlePayment函数，使用handlePaymentClick替代
  const handlePaymentProcess = async (songId) => {
    try {
      const response = await fetch(`/api/songs/${songId}/pay`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('创建支付订单失败');
      }
      
      const html = await response.text();
      document.body.innerHTML += html;

      // 定期检查支付状态
      const checkInterval = setInterval(async () => {
        await checkPaymentStatus(songId);
      }, 3000);

      // 60秒后停止检查
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 60000);
      
    } catch (err) {
      setError(err.message || '支付失败');
    }
  };

  // 处理长按优先队列
  const handlePriorityPress = (e, songId) => {
    if (!adminPassword) {
      setError('请输入管理员密码');
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/songs/${songId}/priority`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            admin_password: adminPassword,
            priority: 1
          })
        });

        if (!response.ok) {
          throw new Error('设置优先级失败');
        }

        fetchSongs();
        setError('');
      } catch (err) {
        setError(err.message || '设置优先级失败');
      }
    }, 1000); // 1秒长按

    setLongPressTimer(timer);
  };

  const handlePriorityRelease = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // 修改支付处理函数
  const handlePayment = async (songId) => {
    try {
      setShowPaymentStatus(true);
      const response = await fetch(`/api/songs/${songId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('创建支付订单失败');
      }
      
      const html = await response.text();
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div);
      
      const script = div.querySelector('script');
      if (script) {
        eval(script.textContent);
      }

      // 定期检查支付状态
      const checkInterval = setInterval(async () => {
        const statusResponse = await fetch(`/api/songs/${songId}/payment-status`);
        const data = await statusResponse.json();
        if (data.status === 'paid') {
          clearInterval(checkInterval);
          setShowPaymentStatus(false);
          fetchSongs();
        }
      }, 3000);

      // 60秒后停止检查
      setTimeout(() => {
        clearInterval(checkInterval);
        setShowPaymentStatus(false);
      }, 60000);
    } catch (err) {
      setError(err.message || '支付失败');
      setShowPaymentStatus(false);
    }
  };

  // 将歌曲分组
  const prioritySongs = songs.filter(song => 
    song.priority > 0 && song.status === (showPlayed ? 'played' : 'pending')
  );
  const normalSongs = songs.filter(song => 
    song.priority === 0 && song.status === (showPlayed ? 'played' : 'pending')
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">点歌列表</h1>
      <Link to="/" className="text-blue-500 hover:text-blue-700 mb-4 block">返回点歌</Link>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">管理员密码</label>
        <input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowPlayed(!showPlayed)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {showPlayed ? '显示未播放歌曲' : '显示已播放歌曲'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {songs.filter(song => showPlayed ? song.status === 'played' : song.status === 'pending').map(song => (
          <div key={song.id} className="border rounded p-4 hover:shadow-lg transition-shadow duration-300">
            {song.cover_url && (
              <a
                href={`https://open.spotify.com/track/${song.spotify_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img src={song.cover_url} alt={song.song_name} className="w-full h-48 object-cover mb-2 hover:opacity-80 transition-opacity duration-300" />
              </a>
            )}
            <a
              href={`https://open.spotify.com/track/${song.spotify_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors duration-300"
            >
              <h3 className="font-bold">{song.song_name}</h3>
            </a>
            <p className="text-gray-600">{song.artist}</p>
            <p className="text-sm text-gray-500">点歌人：{song.chinese_name} ({song.english_name})</p>
            <div className="flex flex-col gap-1 mt-2">
              <p className={`text-sm ${song.status === 'played' ? 'text-green-500' : 'text-red-500'}`}>
                状态：{song.status === 'played' ? '已播放' : '待播放'}
              </p>
              <p className={`text-sm ${song.priority > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
                优先级：{song.priority > 0 ? '优先播放' : '普通'}
              </p>
              <p className={`text-sm ${song.payment_status === 'paid' ? 'text-green-500' : 'text-gray-500'}`}>
                支付状态：{song.payment_status === 'paid' ? '已支付' : '未支付'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange(song.id, song.status === 'played' ? 'pending' : 'played')}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
              >
                {song.status === 'played' ? '标记未播放' : '标记已播放'}
              </button>
              <button
                onClick={() => handleDelete(song.id)}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
              >
                删除
              </button>
              
              {song.payment_status !== 'paid' && song.status !== 'played' && (
                <button
                  onMouseDown={(e) => handlePriorityPress(e, song.id)}
                  onMouseUp={handlePriorityRelease}
                  onMouseLeave={handlePriorityRelease}
                  onClick={() => handlePaymentClick(song.id)}  // 改为使用handlePaymentClick
                  className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  优先队列
                </button>
              )}
              
              {/* 在组件末尾添加支付模态框 */}
              <PaymentModal
                show={showPaymentModal}
                onClose={() => {
                  setShowPaymentModal(false);
                  setSelectedSongId(null);
                }}
                songId={selectedSongId}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SongList;