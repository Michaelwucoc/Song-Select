import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { debounce } from 'lodash';

function App() {
  const [formData, setFormData] = useState({
    chinese_name: '',
    english_name: '',
    song_name: '',
    spotify_url: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [nameErrors, setNameErrors] = useState({});

  const validateNames = (name, value) => {
    if (name === 'chinese_name') {
      const chineseRegex = /^[\u4e00-\u9fa5]{2,4}$/;
      return chineseRegex.test(value) ? '' : '中文名必须是2-4个汉字';
    } else if (name === 'english_name') {
      const englishRegex = /^[a-zA-Z\s]+$/;
      return englishRegex.test(value) ? '' : '英文名只能包含英文字母';
    }
    return '';
  };

  const debouncedSearch = useRef(
    debounce(async (searchTerm) => {
      if (!searchTerm) return;
      try {
        const response = await fetch('/api/songs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ song_name: searchTerm })
        });

        if (!response.ok) {
          throw new Error('请求失败');
        }

        const data = await response.json();
        setSearchResults(data);
        setError('');
      } catch (err) {
        setError(err.message || '搜索失败');
      }
    }, 1000)
  ).current;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'chinese_name' || name === 'english_name') {
      const error = validateNames(name, value);
      setNameErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'song_name') {
      debouncedSearch(value);
    }
  };

  const handleSpotifyUrlChange = async (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, spotify_url: url }));
    
    // 解析Spotify URL获取歌曲ID
    const spotifyIdMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    if (spotifyIdMatch) {
      try {
        const response = await fetch('/api/songs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ spotify_id: spotifyIdMatch[1] })
        });

        if (!response.ok) {
          throw new Error('获取歌曲信息失败');
        }

        const data = await response.json();
        if (data.length > 0) {
          const song = data[0];
          setFormData(prev => ({
            ...prev,
            song_name: song.name
          }));
          setSearchResults([song]);
        }
      } catch (err) {
        setError(err.message || '获取歌曲信息失败');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 验证输入
    const chineseNameError = validateNames('chinese_name', formData.chinese_name);
    const englishNameError = validateNames('english_name', formData.english_name);
    
    // 验证歌曲名称和Spotify链接至少填写一个
    if (!formData.song_name && !formData.spotify_url) {
      setError('请填写歌曲名称或Spotify链接其中之一');
      return;
    }
    
    setNameErrors({
      chinese_name: chineseNameError,
      english_name: englishNameError
    });

    if (chineseNameError || englishNameError) {
      return;
    }

    // 触发搜索
    if (formData.song_name) {
      debouncedSearch(formData.song_name);
    }
  };

  const handleSongSelect = async (song) => {
    try {
      const response = await fetch('/api/songs/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          song_name: song.name,
          artist: song.artists[0].name,
          cover_url: song.album.images[0]?.url,
          spotify_id: song.id
        })
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      setFormData({
        chinese_name: '',
        english_name: '',
        song_name: ''
      });
      setSearchResults([]);
      setError('');
      alert('点歌成功！');
    } catch (err) {
      setError(err.message || '提交失败');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">校园点歌系统 V1.0 Mar 17</h1>
      <Link to="/songs" className="inline-block bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold py-2 px-6 rounded-full hover:from-blue-600 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 mb-6 shadow-lg">
        <span className="flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
          </svg>
          查看点歌列表
        </span>
      </Link>
      
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">中文名</label>
          <input
            type="text"
            name="chinese_name"
            value={formData.chinese_name}
            onChange={handleInputChange}
            required
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${nameErrors.chinese_name ? 'border-red-500' : ''}`}
          />
          {nameErrors.chinese_name && (
            <p className="text-red-500 text-xs italic mt-1">{nameErrors.chinese_name}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">英文名</label>
          <input
            type="text"
            name="english_name"
            value={formData.english_name}
            onChange={handleInputChange}
            required
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${nameErrors.english_name ? 'border-red-500' : ''}`}
          />
          {nameErrors.english_name && (
            <p className="text-red-500 text-xs italic mt-1">{nameErrors.english_name}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">歌曲名称或Spotify链接（二选一）</label>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                name="song_name"
                value={formData.song_name}
                onChange={handleInputChange}
                placeholder="输入歌曲名称（中文请使用繁体）"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 text-gray-500 bg-white">或</span>
              </div>
            </div>
            <div>
              <input
                type="text"
                name="spotify_url"
                value={formData.spotify_url}
                onChange={handleSpotifyUrlChange}
                placeholder="https://open.spotify.com/track/..."
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
        >
          搜索歌曲
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">搜索结果</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map(song => (
              <div key={song.id} className="border rounded p-4 hover:shadow-lg transition-shadow duration-300">
                {song.album.images[0] && (
                  <a
                    href={`https://open.spotify.com/track/${song.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img src={song.album.images[0].url} alt={song.name} className="w-full h-48 object-cover mb-2 hover:opacity-80 transition-opacity duration-300" />
                  </a>
                )}
                <a
                  href={`https://open.spotify.com/track/${song.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors duration-300"
                >
                  <h3 className="font-bold">{song.name}</h3>
                </a>
                <p className="text-gray-600">{song.artists[0].name}</p>
                <button
                  onClick={() => handleSongSelect(song)}
                  className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  选择
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;