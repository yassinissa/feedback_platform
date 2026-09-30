"""Per-branch "install as app" support for the guest iPads.

iOS 15 ignores manifest icons and uses <link rel="apple-touch-icon">, so each
branch gets a generated square PNG icon (its logo on its light/dark tile) plus
a web manifest whose start_url is that branch's guest form.
"""

import json
from functools import lru_cache
from io import BytesIO

from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.html import escape
from PIL import Image, ImageDraw

from .models import Location

ICON_SIZES = {180, 192, 512}
EVERGREEN = (15, 110, 102)
WHITE = (255, 255, 255)
LONG_CACHE = "public, max-age=31536000, immutable"


def _face_icon(size: int) -> Image.Image:
    """Fallback icon (no logo): the smiling mark on the evergreen tile."""
    scale = 4  # draw large, downsample for smooth edges
    s = size * scale
    img = Image.new("RGB", (s, s), EVERGREEN)
    d = ImageDraw.Draw(img)
    eye_r = s * 0.065
    for cx in (s * 0.36, s * 0.64):
        d.ellipse([cx - eye_r, s * 0.39 - eye_r, cx + eye_r, s * 0.39 + eye_r], fill=WHITE)
    w = int(s * 0.075)
    d.arc([s * 0.27, s * 0.30, s * 0.73, s * 0.76], start=25, end=155, fill=WHITE, width=w)
    return img.resize((size, size), Image.LANCZOS)


@lru_cache(maxsize=64)
def _render_icon(logo: bytes | None, logo_bg: str, size: int) -> bytes:
    if not logo:
        img = _face_icon(size)
    else:
        bg = (255, 255, 255) if logo_bg == "light" else (20, 20, 20)
        img = Image.new("RGB", (size, size), bg)
        mark = Image.open(BytesIO(logo)).convert("RGBA")
        box = int(size * 0.74)  # iOS rounds the corners; keep the logo clear of them
        mark.thumbnail((box, box), Image.LANCZOS)
        img.paste(mark, ((size - mark.width) // 2, (size - mark.height) // 2), mark)
    out = BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def icon_url(location: Location | None, size: int) -> str:
    if location is None:
        return f"/api/public/icon-{size}.png"
    v = int(location.logo_updated.timestamp()) if location.logo_updated else 0
    return f"/api/public/locations/{location.slug}/icon-{size}.png?v={v}-{location.logo_bg}"


def branch_icon(request, slug, size):
    if size not in ICON_SIZES:
        raise Http404
    loc = get_object_or_404(Location, slug=slug)
    png = _render_icon(bytes(loc.logo) if loc.logo else None, loc.logo_bg, size)
    response = HttpResponse(png, content_type="image/png")
    response["Cache-Control"] = LONG_CACHE
    return response


def default_icon(request, size):
    if size not in ICON_SIZES:
        raise Http404
    response = HttpResponse(_render_icon(None, "dark", size), content_type="image/png")
    response["Cache-Control"] = "public, max-age=86400"
    return response


def branch_manifest(request, slug):
    loc = get_object_or_404(Location, slug=slug)
    start = f"/f/{loc.slug}"
    manifest = {
        "id": start,
        "name": f"{loc.name} Feedback",
        "short_name": loc.name[:12],
        "start_url": start,
        "scope": start,
        "display": "standalone",
        "orientation": "any",
        "background_color": "#f6f4f0",
        "theme_color": "#ffffff",
        "icons": [
            {"src": icon_url(loc, 192), "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": icon_url(loc, 512), "sizes": "512x512", "type": "image/png", "purpose": "any"},
        ],
    }
    response = HttpResponse(json.dumps(manifest), content_type="application/manifest+json")
    response["Cache-Control"] = "no-cache"
    return response


def guest_head_tags(slug: str) -> str | None:
    """<head> tags that make "Add to Home Screen" install this branch's form as its own app."""
    loc = Location.objects.filter(slug=slug, is_active=True).first()
    if loc is None:
        return None
    name = escape(loc.name)
    return (
        f'<link rel="manifest" href="/api/public/locations/{loc.slug}/manifest.webmanifest" />'
        f'<link rel="apple-touch-icon" sizes="180x180" href="{icon_url(loc, 180)}" />'
        f'<meta name="apple-mobile-web-app-title" content="{escape(loc.name[:14])}" />'
        f"<title>{name} · Feedback</title>"
    )
