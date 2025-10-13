# views.py
import re
from pytubefix import YouTube, Playlist
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from pytubefix.cli import on_progress
import requests  # Import the requests library for streaming
from django.http import FileResponse
import os
import re, urllib.parse ,subprocess
import io
# @api_view(["GET"])
class youtube_info(APIView):
    def get(self, request, *args, **kwargs):
        print("youtube_info request received")
        raw_url = request.GET.get("url")
        if not raw_url:
            return Response({"error": "No URL provided"}, status=400)

        try:
            # url = clean_youtube_url(raw_url)
            url = raw_url  # Use raw URL directly for pytubefix

            # Playlist handling
            if "list=" in url:
                pl = Playlist(url)
                first_20_urls = pl.video_urls[:20]
                items = []
                for video_url in first_20_urls:
                    try:
                        yt = YouTube(video_url, use_po_token=False)
                        items.append({
                            "title": yt.title,
                            "thumbnail": yt.thumbnail_url,
                            "videoId": yt.video_id,
                            "url": yt.watch_url
                        })
                    except Exception as e:
                        # Instead of crashing, just keep the raw URL
                        items.append({
                            "error": str(e),
                            "videoId": video_url,  # fallback: extract id from url
                            "title": "Unavailable Video",
                            "thumbnail": None
                        })
                return Response({
                    "type": "playlist",
                    "title": pl.title,
                    "total_count": len(pl.video_urls),
                    "fetched_count": len(items),
                    "items": items
                }, status=200)

        
            # else: single video
            yt = YouTube(url, use_po_token=False)
            item = {
                "title": yt.title,
                "thumbnail": yt.thumbnail_url,
                "videoId": yt.video_id,
                "url":yt.watch_url
            }
            return Response({
                "type": "video",
                "title": yt.title,
                "total_count": 1,
                "fetched_count": 1,
                "items": [item]
            }, status=200)

        except Exception as e:
            return Response({"error": str(e), "url_used": url, "raw_url": raw_url}, status=400)

class download(APIView):
    def get(self, request, *args, **kwargs):
        print("download request received")
       
        url = request.GET.get("url")
        type = request.GET.get("type", "mp4")
        print(f"Requested type: {type}")
        print(f"Download request for URL: {url}")
        if not url:
            return Response({"error": "No URL provided"}, status=400)
        yt = YouTube(url)
        title = yt.title  # keep Malayalam/Unicode title
        thumbnail = yt.thumbnail_url
        safe_title = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', yt.title)[:50]
        # stream = yt.streams.get_highest_resolution()
        encoded_title = urllib.parse.quote(title)
        if type == "mp3":
            stream = yt.streams.filter(only_audio=True).first()
            buffer = io.BytesIO()
            stream.stream_to_buffer(buffer)
            buffer.seek(0)
            response = StreamingHttpResponse(buffer, content_type="audio/mpeg")
            response["Content-Disposition"] = f'attachment; filename="{safe_title}.mp3"'
            response["Content-Disposition"] += f"; filename*=UTF-8''{encoded_title}.mp3"
            response["X-Audio-Title"] = title


           
        else:
            stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            buffer = io.BytesIO()
            stream.stream_to_buffer(buffer)
            buffer.seek(0) 

            response = StreamingHttpResponse(buffer, content_type="video/mp4")
            response["Content-Disposition"] = f'attachment; filename="{safe_title}.mp4"'
        # Add Unicode filename with RFC 5987 encoding
        
            response["Content-Disposition"] += f"; filename*=UTF-8''{encoded_title}.mp4"
            response["X-Video-Title"] = title
        response["X-Thumbnail-Url"] = thumbnail
        return response