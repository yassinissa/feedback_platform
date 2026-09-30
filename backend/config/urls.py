import re

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.decorators.cache import never_cache

from feedback.app_install import guest_head_tags

GUEST_PATH = re.compile(r"^f/(?P<slug>[-a-zA-Z0-9_]+)/?$")
# Generic app tags in index.html that a branch page replaces with its own.
GENERIC_TAGS = re.compile(
    r'<link rel="manifest"[^>]*>|<link rel="apple-touch-icon"[^>]*>'
    r'|<meta name="apple-mobile-web-app-title"[^>]*>|<title>.*?</title>',
    re.S,
)


@never_cache
def spa(request, path=""):
    """Serve the React app for every non-API route (client-side routing).

    Guest pages (/f/<slug>) get that branch's manifest, icon and name so
    "Add to Home Screen" installs the branch form as its own app.
    """
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse("Frontend not built. Run `npm run build` in /frontend, or use the Vite dev server.", status=503)
    html = index.read_text(encoding="utf-8")
    match = GUEST_PATH.match(path)
    if match:
        tags = guest_head_tags(match["slug"])
        if tags:
            html = GENERIC_TAGS.sub("", html).replace("</head>", f"{tags}</head>", 1)
    return HttpResponse(html, content_type="text/html; charset=utf-8")


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include("feedback.urls")),
    re_path(r"^(?!api/|django-admin/|static/)(?P<path>.*)$", spa),
]
