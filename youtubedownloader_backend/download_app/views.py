# from django.http import FileResponse
import os
import re
import shutil
import tempfile
import urllib.parse
from django.http import StreamingHttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView
import yt_dlp

class youtube_info(APIView):
    def get(self, request, *args, **kwargs):
        print("youtube_info request received")
        raw_url = request.GET.get("url")
        if not raw_url:
            return Response({"error": "No URL provided"}, status=400)

        try:
            ydl_opts = {
                "quiet": True,
                "extract_flat": "in_playlist",  # fast extraction without downloading
                "skip_download": True,
                "js_runtimes": {"node": {}},
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(raw_url, download=False)

            # Check if URL is a Playlist
            if "entries" in info:
                entries = list(info.get("entries", []))[:20]
                items = []
                for entry in entries:
                    if entry:
                        video_id = entry.get("id")
                        thumbnail = entry.get("thumbnail")
                        if not thumbnail and entry.get("thumbnails"):
                            thumbnail = entry.get("thumbnails")[-1].get("url")
                        if not thumbnail and video_id:
                            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                        items.append(
                            {
                                "title": entry.get("title", "Unavailable Video"),
                                "thumbnail": thumbnail,
                                "videoId": video_id,
                                "url": entry.get("url") or entry.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
                            }
                        )

                return Response(
                    {
                        "type": "playlist",
                        "title": info.get("title", "Playlist"),
                        "total_count": len(info.get("entries", [])),
                        "fetched_count": len(items),
                        "items": items,
                    },
                    status=200,
                )

            # Single video
            thumbnail = info.get("thumbnail")
            if not thumbnail and info.get("thumbnails"):
                thumbnail = info.get("thumbnails")[-1].get("url")
            if not thumbnail and info.get("id"):
                thumbnail = f"https://i.ytimg.com/vi/{info.get('id')}/hqdefault.jpg"

            item = {
                "title": info.get("title", "YouTube Video"),
                "thumbnail": thumbnail,
                "videoId": info.get("id"),
                "url": info.get("webpage_url", raw_url),
            }

            return Response(
                {
                    "type": "video",
                    "title": info.get("title"),
                    "total_count": 1,
                    "fetched_count": 1,
                    "items": [item],
                },
                status=200,
            )

        except Exception as e:
            import traceback

            print("YOUTUBE ERROR:", str(e))
            traceback.print_exc()
            return Response(
                {"error": str(e), "raw_url": raw_url},
                status=400,
            )

def file_iterator_with_cleanup(file_path, temp_dir, chunk_size=8192):
    """
    Yields chunks of the file and removes the temp directory 
    when the transfer finishes or client disconnects.
    """
    try:
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                yield chunk
    finally:
        # Automatically clean up the temp directory after streaming
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

class download(APIView):
    def get(self, request, *args, **kwargs):
        url = request.GET.get("url")
        media_type = request.GET.get("type", "mp4").lower()

        if not url:
            return Response({"error": "No URL provided"}, status=400)

        temp_dir = tempfile.mkdtemp()

        try:
            base_opts = {
                "outtmpl": os.path.join(temp_dir, "%(title)s.%(ext)s"),
                "quiet": True,
                "noplaylist": True,
                "concurrent_fragment_downloads": 5,
                "js_runtimes": {"node": {}},
            }

            if media_type == "mp3":
                ydl_opts = {
                    **base_opts,
                    "format": "bestaudio/best",
                    "postprocessors": [
                        {
                            "key": "FFmpegExtractAudio",
                            "preferredcodec": "mp3",
                            "preferredquality": "128",
                        }
                    ],
                }
                content_type = "audio/mpeg"
                ext = "mp3"
            else:
                ydl_opts = {
                    **base_opts,
                    "format": "best[ext=mp4][vcodec^=avc1]/best[ext=mp4]/best",
                }
                content_type = "video/mp4"
                ext = "mp4"

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get("title", "download") if info else "download"
                thumbnail = info.get("thumbnail", "") if info else ""

            # Locate downloaded file in temp_dir reliably
            downloaded_file = None
            files = [os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, f))]
            if files:
                ext_files = [f for f in files if f.endswith(f".{ext}")]
                if ext_files:
                    downloaded_file = ext_files[0]
                else:
                    downloaded_file = files[0]

            if not downloaded_file or not os.path.exists(downloaded_file):
                raise Exception("Downloaded file not found on server.")

            safe_title = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", title)[:50]
            encoded_title = urllib.parse.quote(title)

            # Stream chunks of 512KB for faster local transfer
            response = StreamingHttpResponse(
                file_iterator_with_cleanup(downloaded_file, temp_dir, chunk_size=512 * 1024),
                content_type=content_type,
            )
            response["Content-Disposition"] = (
                f'attachment; filename="{safe_title}.{ext}"; '
                f"filename*=UTF-8''{encoded_title}.{ext}"
            )
            response["Access-Control-Expose-Headers"] = "Content-Disposition, X-Audio-Title, X-Video-Title, X-Thumbnail-Url"

            if os.path.exists(downloaded_file):
                response["Content-Length"] = os.path.getsize(downloaded_file)

            if media_type == "mp3":
                response["X-Audio-Title"] = safe_title
            else:
                response["X-Video-Title"] = safe_title

            response["X-Thumbnail-Url"] = thumbnail
            return response

        except Exception as e:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)

        