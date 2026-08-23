# from django.http import FileResponse
import os
import re
import shutil
import tempfile
import urllib.parse
import requests
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, TIT2, TALB, error
from django.http import StreamingHttpResponse, HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView
import yt_dlp

def build_content_disposition(title, ext, suffix=""):
    """
    Creates RFC 6266 compliant Content-Disposition header.
    Guarantees ASCII fallback filename and UTF-8 encoded filename for all languages.
    """
    clean_title = re.sub(r'[\\/*?:"<>|\r\n]', "", title or "").strip()
    if not clean_title:
        clean_title = "download"
    clean_title = clean_title[:60]

    ascii_clean = re.sub(r"[^a-zA-Z0-9_\-]", "_", title or "").strip("_")
    ascii_clean = re.sub(r"_+", "_", ascii_clean)[:30]
    if not ascii_clean:
        ascii_clean = "download"

    full_filename = f"{clean_title}{suffix}.{ext}"
    ascii_filename = f"{ascii_clean}{suffix}.{ext}"

    encoded_utf8 = urllib.parse.quote(full_filename, safe="")

    return f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_utf8}'


def process_thumbnail_to_400x400_jpg(raw_bytes):
    """
    Fits the ENTIRE thumbnail image into an exact 400x400 square format without cutting or cropping any part.
    Returns JPEG binary data.
    """
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")

        # 400x400 canvas with clean dark background
        canvas = Image.new("RGB", (400, 400), (0, 0, 0))

        width, height = img.size
        scale = min(400.0 / width, 400.0 / height)
        new_width = int(width * scale)
        new_height = int(height * scale)

        img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        offset_x = (400 - new_width) // 2
        offset_y = (400 - new_height) // 2
        canvas.paste(img_resized, (offset_x, offset_y))

        output = io.BytesIO()
        canvas.save(output, format="JPEG", quality=95)
        return output.getvalue()
    except Exception as e:
        print(f"Error fitting image to 400x400 JPG: {e}")
        return raw_bytes

        print(f"Error processing image to 400x400 JPG: {e}")
        return raw_bytes


def embed_thumbnail_and_metadata(mp3_file_path, thumbnail_url, title):
    try:
        audio = MP3(mp3_file_path, ID3=ID3)
        try:
            audio.add_tags()
        except error:
            pass

        if title:
            audio.tags.add(TIT2(encoding=3, text=title))
            audio.tags.add(TALB(encoding=3, text="YouTube Download"))

        if thumbnail_url:
            resp = requests.get(thumbnail_url, timeout=10)
            if resp.status_code == 200:
                image_data = process_thumbnail_to_400x400_jpg(resp.content)
                audio.tags.add(
                    APIC(
                        encoding=3,
                        mime="image/jpeg",
                        type=3,  # Cover (front)
                        desc="Cover",
                        data=image_data,
                    )
                )
        audio.save()
        print("Successfully embedded 400x400 thumbnail into MP3 file.")
    except Exception as e:
        print(f"Failed to embed thumbnail into MP3: {str(e).encode('ascii', 'ignore').decode()}")





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

            # If MP3 audio, attempt embedding thumbnail metadata safely without breaking download
            if media_type == "mp3":
                try:
                    embed_thumbnail_and_metadata(downloaded_file, thumbnail, title)
                except Exception as meta_err:
                    print(f"MP3 metadata embedding notice: {meta_err}")


            # Stream chunks of 512KB for faster local transfer, forcing octet-stream attachment
            response = StreamingHttpResponse(
                file_iterator_with_cleanup(downloaded_file, temp_dir, chunk_size=512 * 1024),
                content_type="application/octet-stream",
            )
            response["Content-Disposition"] = build_content_disposition(title, ext)
            response["Access-Control-Expose-Headers"] = "Content-Disposition, X-Audio-Title, X-Video-Title, X-Thumbnail-Url"

            if os.path.exists(downloaded_file):
                response["Content-Length"] = os.path.getsize(downloaded_file)

            if media_type == "mp3":
                response["X-Audio-Title"] = title[:50]
            else:
                response["X-Video-Title"] = title[:50]

            response["X-Thumbnail-Url"] = thumbnail
            return response

        except Exception as e:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)


class download_thumbnail(APIView):
    def get(self, request, *args, **kwargs):
        thumbnail_param = request.GET.get("thumbnail_url")
        raw_url = request.GET.get("url")
        video_id = request.GET.get("videoId")
        title = request.GET.get("title", "thumbnail")

        thumbnail_url = None

        if thumbnail_param and (thumbnail_param.startswith("http://") or thumbnail_param.startswith("https://")):
            thumbnail_url = thumbnail_param
        elif video_id:
            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        elif raw_url:
            if "ytimg.com" in raw_url or "ggpht.com" in raw_url or raw_url.endswith((".jpg", ".jpeg", ".png", ".webp")):
                thumbnail_url = raw_url
            else:
                match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", raw_url)
                if match:
                    thumbnail_url = f"https://i.ytimg.com/vi/{match.group(1)}/hqdefault.jpg"
                else:
                    try:
                        ydl_opts = {"quiet": True, "skip_download": True, "js_runtimes": {"node": {}}}
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            info = ydl.extract_info(raw_url, download=False)
                            if info:
                                thumbnail_url = info.get("thumbnail")
                                if not thumbnail_url and info.get("thumbnails"):
                                    thumbnail_url = info.get("thumbnails")[-1].get("url")
                    except Exception as yt_err:
                        print(f"yt_dlp extraction notice in download_thumbnail: {yt_err}")

        if not thumbnail_url:
            return Response({"error": "Thumbnail image not found"}, status=404)

        try:
            resp = requests.get(thumbnail_url, timeout=10)
            if resp.status_code != 200:
                return Response({"error": "Failed to fetch thumbnail image"}, status=400)

            jpeg_bytes = process_thumbnail_to_400x400_jpg(resp.content)

            response = HttpResponse(jpeg_bytes, content_type="application/octet-stream")
            response["Content-Disposition"] = build_content_disposition(title, "jpg", "_400x400")
            response["Access-Control-Expose-Headers"] = "Content-Disposition"
            return response



        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)
