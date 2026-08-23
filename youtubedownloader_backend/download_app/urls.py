# urls.py
from django.urls import path,re_path
from . import views 
# Add this print statement
print("Loading download_app URL patterns...")
urlpatterns = [
    path("info/", views.youtube_info.as_view()),
    path("download/", views.download.as_view()),
    path("download-thumbnail/", views.download_thumbnail.as_view()),
]

