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
  const [autoDownloadThumb, setAutoDownloadThumb] = useState(true);

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

  const getSafeFileName = (title, ext, suffix = "") => {
    if (!title) return `download${suffix}.${ext}`;
    const clean = title.replace(/[\\/*?:"<>|\r\n]/g, "").trim().slice(0, 50);
    return `${clean || "download"}${suffix}.${ext}`;
  };

  const triggerBlobSave = (rawBlob, fileName) => {
    const octetBlob = new Blob([rawBlob], { type: "application/octet-stream" });
    const blobUrl = URL.createObjectURL(octetBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
  };


  const handleThumbnailDownload = (videoUrl, title, videoId, thumbnailUrl = "") => {
    const key = `${videoId}_thumb`;
    setDownloadingMap((prev) => ({ ...prev, [key]: true }));

    const imageUrl = thumbnailUrl || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");
    const fileName = getSafeFileName(title, "jpg", "_400x400");

    const fallbackBackendDownload = async () => {
      const endpoint = `${Baseurl}${Url.downloadThumbnail}?thumbnail_url=${encodeURIComponent(imageUrl)}&url=${encodeURIComponent(videoUrl)}&videoId=${encodeURIComponent(videoId)}&title=${encodeURIComponent(title || "thumbnail")}`;
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Thumbnail fetch error");
        const blob = await response.blob();
        triggerBlobSave(blob, fileName);
      } catch (err) {
        const link = document.createElement("a");
        link.href = endpoint;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        setDownloadingMap((prev) => ({ ...prev, [key]: false }));
      }
    };

    if (!imageUrl) {
      fallbackBackendDownload();
      return;
    }

    // Client-side canvas fit to 400x400 without cutting or cropping
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d");

        // Fill background with black
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 400, 400);

        // Fit entire image into 400x400 frame preserving aspect ratio
        const scale = Math.min(400 / img.width, 400 / img.height);
        const newWidth = img.width * scale;
        const newHeight = img.height * scale;
        const offsetX = (400 - newWidth) / 2;
        const offsetY = (400 - newHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              triggerBlobSave(blob, fileName);
              setDownloadingMap((prev) => ({ ...prev, [key]: false }));
            } else {
              fallbackBackendDownload();
            }
          },
          "image/jpeg",
          0.95
        );
      } catch (err) {
        fallbackBackendDownload();
      }
    };


    img.onerror = () => {
      fallbackBackendDownload();
    };
  };

  const handleDownload = async (videoUrl, type, videoId, itemTitle = "", itemThumbnail = "") => {
    const key = `${videoId}_${type}`;
    setDownloadingMap((prev) => ({ ...prev, [key]: true }));

    const fileName = getSafeFileName(itemTitle, type);
    const downloadEndpoint = `${Baseurl}${Url.download}?url=${encodeURIComponent(videoUrl)}&type=${type}&quality=${compressMode}`;

    try {
      const response = await fetch(downloadEndpoint);
      if (!response.ok) throw new Error("Download request failed on server.");
      const blob = await response.blob();
      triggerBlobSave(blob, fileName);
    } catch (err) {
      console.error("Fetch download fallback notice:", err);
      const link = document.createElement("a");
      link.href = downloadEndpoint;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingMap((prev) => ({ ...prev, [key]: false }));
    }

    if (type === "mp3" && autoDownloadThumb) {
      setTimeout(() => {
        handleThumbnailDownload(videoUrl, itemTitle, videoId, itemThumbnail);
      }, 500);
    }
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

        <div className='switch-group'>
          <span className='switch-label'>Auto-Download Thumbnail:</span>
          <div className='switch-container'>
            <button
              type="button"
              className={`switch-option ${autoDownloadThumb ? 'active' : ''}`}
              onClick={() => setAutoDownloadThumb(true)}
            >
              🖼️ Yes (With MP3)
            </button>
            <button
              type="button"
              className={`switch-option ${!autoDownloadThumb ? 'active' : ''}`}
              onClick={() => setAutoDownloadThumb(false)}
            >
              🚫 Off
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
            const isThumbLoading = downloadingMap[`${videoId}_thumb`];

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
                        onClick={() => handleDownload(item.url, "mp3", videoId, item.title, item.thumbnail)}
                        disabled={isMp3Loading}
                      >
                        {isMp3Loading ? (
                          <span className='btn-spinner-group'>
                            <span className='spinner-sm'></span> Starting...
                          </span>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
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
                        onClick={() => handleDownload(item.url, "mp4", videoId, item.title, item.thumbnail)}
                        disabled={isMp4Loading}
                      >
                        {isMp4Loading ? (
                          <span className='btn-spinner-group'>
                            <span className='spinner-sm'></span> Starting...
                          </span>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                              <path d="M23 7l-7 5 7 5V7z" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            Download MP4
                          </>
                        )}
                      </button>
                    )}

                    <button
                      className={`download-btn btn-thumb ${isThumbLoading ? 'is-loading' : ''}`}
                      onClick={() => handleThumbnailDownload(item.url, item.title, videoId, item.thumbnail)}
                      disabled={isThumbLoading}
                    >
                      {isThumbLoading ? (
                        <span className='btn-spinner-group'>
                          <span className='spinner-sm'></span> Resizing...
                        </span>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          Download Thumbnail (400x400 JPG)
                        </>
                      )}
                    </button>
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

