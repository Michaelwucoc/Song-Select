import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function SongList() {
  const [songs, setSongs] = useState([]);
  const [error, setError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPlayed, setShowPlayed] = useState(false);

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
            <p className={`text-sm mb-2 ${song.status === 'played' ? 'text-green-500' : 'text-red-500'}`}>
              状态：{song.status === 'played' ? '已播放' : '待播放'}
            </p>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SongList;