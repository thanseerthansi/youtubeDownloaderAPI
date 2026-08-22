import React, { useState } from 'react'
import { ApiCall } from '../../service/ApiCall';
import { Baseurl, Url } from '../../constants/Urls';

export default function DownloadHome() {
  const [btnLoad, setBtnLoad] = useState(false);
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [playlistMeta, setPlaylistMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingMap, setDownloadingMap] = useState({});
  const [filterMode, setFilterMode] = useState("all"); // 'all', 'mp3', 'mp4'
  const [compressMode, setCompressMode] = useState("128"); // '128' (Standard Compressed), '96' (High Compression)

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setErrorMsg("Please enter a YouTube video or playlist link.");
      return;
    }

    setBtnLoad(true);
    setErrorMsg("");
    setData(null);
    setPlaylistMeta(null);

    const info = await ApiCall("get", Url.info, null, { url: url.trim() });
    
    if (info.status && info.message) {
      if (info.message.type === "playlist") {
        setPlaylistMeta({
          title: info.message.title,
          totalCount: info.message.total_count,
          fetchedCount: info.message.fetched_count
        });
      }
      setData(info.message.items || []);
    } else {
      setErrorMsg(info.error || "Failed to fetch video information. Please verify the URL.");
    }
    setBtnLoad(false);
  };

  const handleDownload = (videoUrl, type, videoId) => {
    const key = `${videoId}_${type}`;
    setDownloadingMap((prev) => ({ ...prev, [key]: true }));

    const downloadEndpoint = `${Baseurl}${Url.download}?url=${encodeURIComponent(videoUrl)}&type=${type}&quality=${compressMode}`;
    
    const link = document.createElement("a");
    link.href = downloadEndpoint;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Reset download state after 3 seconds
    setTimeout(() => {
      setDownloadingMap((prev) => ({ ...prev, [key]: false }));
    }, 3000);
  };

  return (
    <div className='downloader-container'>
      <div className='hero-section'>
        <div className='badge-pill'>
          <span className='sparkle-icon'>✨</span> Fast & Free YouTube Converter
        </div>
        <h1 className='hero-title'>
          Download YouTube Videos & Audio <span className='title-gradient'>Instantly</span>
        </h1>
        <p className='hero-subtitle'>
          Extract compressed MP3 audio with embedded thumbnails & crisp MP4 videos from YouTube.
        </p>
      </div>

      <form className='search-form' onSubmit={handleSearch}>
        <div className='search-box'>
          <div className='search-icon'>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            className='search-input'
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errorMsg) setErrorMsg("");
            }}
            type="text"
            placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=...)"
          />
          {url && (
            <button
              type="button"
              className='clear-btn'
              onClick={() => {
                setUrl("");
                setErrorMsg("");
              }}
            >
              ✕
            </button>
          )}
          <button className='search-btn' disabled={btnLoad} type="submit">
            {btnLoad ? (
              <span className='btn-spinner-group'>
                <span className='spinner-sm'></span> Fetching...
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className='error-banner'>
          <span className='error-icon'>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Switches & Controls Section */}
      <div className='controls-bar'>
        <div className='switch-group'>
          <span className='switch-label'>Format Filter:</span>
          <div className='switch-container'>
            <button
              type="button"
              className={`switch-option ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Formats
            </button>
            <button
              type="button"
              className={`switch-option ${filterMode === 'mp3' ? 'active' : ''}`}
              onClick={() => setFilterMode('mp3')}
            >
              🎵 Audio (MP3)
            </button>
            <button
              type="button"
              className={`switch-option ${filterMode === 'mp4' ? 'active' : ''}`}
              onClick={() => setFilterMode('mp4')}
            >
              🎬 Video (MP4)
            </button>
          </div>
        </div>

        <div className='switch-group'>
          <span className='switch-label'>Audio Bitrate Compression:</span>
          <div className='switch-container'>
            <button
              type="button"
              className={`switch-option ${compressMode === '128' ? 'active' : ''}`}
              onClick={() => setCompressMode('128')}
            >
              128 kbps (Standard)
            </button>
            <button
              type="button"
              className={`switch-option ${compressMode === '96' ? 'active' : ''}`}
              onClick={() => setCompressMode('96')}
            >
              96 kbps (High Compress)
            </button>
          </div>
        </div>
      </div>

      {playlistMeta && (
        <div className='playlist-header'>
          <div className='playlist-info'>
            <span className='playlist-badge'>Playlist</span>
            <h2 className='playlist-title'>{playlistMeta.title}</h2>
          </div>
          <span className='playlist-count'>
            Showing {playlistMeta.fetchedCount} of {playlistMeta.totalCount} items
          </span>
        </div>
      )}

      {btnLoad && (
        <div className='skeleton-loader'>
          <div className='loader-spinner'></div>
          <p>Extracting video information from YouTube...</p>
        </div>
      )}

      {data && data.length > 0 && !btnLoad && (
        <div className='results-grid'>
          {data.map((item, index) => {
            const videoId = item.videoId || index;
            const isMp3Loading = downloadingMap[`${videoId}_mp3`];
            const isMp4Loading = downloadingMap[`${videoId}_mp4`];

            return (
              <div key={videoId} className='video-card'>
                <div className='card-thumbnail-wrapper'>
                  <img
                    src={item.thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60"}
                    alt={item.title}
                    className='card-thumbnail'
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60";
                    }}
                  />
                  <div className='thumbnail-badge'>#{index + 1}</div>
                </div>
                <div className='card-content'>
                  <h3 className='video-title' title={item.title}>
                    {item.title}
                  </h3>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className='video-url-link'
                  >
                    {item.url}
                  </a>

                  <div className='card-actions'>
                    {(filterMode === 'all' || filterMode === 'mp3') && (
                      <button
                        className={`download-btn btn-mp3 ${isMp3Loading ? 'is-loading' : ''}`}
                        onClick={() => handleDownload(item.url, "mp3", videoId)}
                        disabled={isMp3Loading}
                      >
                        {isMp3Loading ? (
                          <span className='btn-spinner-group'>
                            <span className='spinner-sm'></span> Starting...
                          </span>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                            Download MP3 ({compressMode}k)
                          </>
                        )}
                      </button>
                    )}

                    {(filterMode === 'all' || filterMode === 'mp4') && (
                      <button
                        className={`download-btn btn-mp4 ${isMp4Loading ? 'is-loading' : ''}`}
                        onClick={() => handleDownload(item.url, "mp4", videoId)}
                        disabled={isMp4Loading}
                      >
                        {isMp4Loading ? (
                          <span className='btn-spinner-group'>
                            <span className='spinner-sm'></span> Starting...
                          </span>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M23 7l-7 5 7 5V7z" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            Download MP4
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
