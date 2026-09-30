import csv
import logging
from collections import Counter
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.db import DatabaseError, connection, transaction
from django.db.models import Avg, Count, Max, Q
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .access import IsAdmin, date_range, day_bounds, scoped_feedback, visible_locations
from .models import CATEGORY_FIELDS, Feedback, Location
from .serializers import (
    FeedbackSerializer,
    FeedbackSubmitSerializer,
    LocationSerializer,
    MeSerializer,
    PublicLocationSerializer,
    TeamMemberSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)

MAX_LOGO_BYTES = 1_000_000
# Sniff real bytes rather than trusting the upload's declared type. SVG is refused:
# it can carry script and would be served from our own origin.
LOGO_SIGNATURES = [
    (bytes.fromhex("89504e470d0a1a0a"), "image/png"),
    (bytes.fromhex("ffd8ff"), "image/jpeg"),
]


def sniff_image(data: bytes):
    for sig, mime in LOGO_SIGNATURES:
        if data.startswith(sig):
            return mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


# ── Aggregation helpers ─────────────────────────────────────────────
# All dashboard numbers are computed by the database, so memory and time stay
# flat as history grows (12 branches × years of feedback).

NPS_AGGREGATES = {
    "nps_n": Count("id", filter=Q(nps__isnull=False)),
    "nps_pro": Count("id", filter=Q(nps__gte=9)),
    "nps_det": Count("id", filter=Q(nps__lte=6)),
}


def nps_from(row):
    """Net Promoter Score from aggregated counts: % promoters − % detractors."""
    n = row["nps_n"]
    return round((row["nps_pro"] - row["nps_det"]) * 100 / n) if n else None


def highlight_counts(qs, limit=14):
    """Most-picked highlight keys, unnested and counted in SQL."""
    sql, params = qs.order_by().values("highlights").query.sql_with_params()
    if connection.vendor == "postgresql":
        query = (
            f"SELECT h, COUNT(*) FROM ({sql}) AS s "
            f"CROSS JOIN LATERAL jsonb_array_elements_text(s.highlights) AS h "
            f"GROUP BY h ORDER BY 2 DESC, 1 LIMIT %s"
        )
    elif connection.vendor == "sqlite":
        query = (
            f"SELECT j.value, COUNT(*) FROM ({sql}) AS s, json_each(s.highlights) AS j "
            f"GROUP BY j.value ORDER BY 2 DESC, 1 LIMIT %s"
        )
    else:
        return _stream_highlight_counts(qs, limit)
    try:
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(query, [*params, limit])
            return [tuple(row) for row in cursor.fetchall()]
    except DatabaseError:
        logger.exception("Highlight SQL failed; falling back to streaming count")
        return _stream_highlight_counts(qs, limit)


def _stream_highlight_counts(qs, limit):
    """Portable fallback: streams rows in chunks, so memory stays flat."""
    counts = Counter(h for hs in qs.values_list("highlights", flat=True).iterator(chunk_size=2000) for h in hs or [])
    return counts.most_common(limit)


def rounded(value, places=2):
    return round(value, places) if value is not None else None


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"ok": True})


# ── Auth ────────────────────────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def login(request):
    user = authenticate(username=request.data.get("username", "").strip(), password=request.data.get("password", ""))
    if not user:
        return Response({"detail": "Username or password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": MeSerializer(user).data})


login.cls.throttle_scope = "login"


@api_view(["GET"])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(["POST"])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Public (guest iPad / QR) ────────────────────────────────────────────


class PublicLocationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        location = get_object_or_404(Location, slug=slug, is_active=True)
        return Response(PublicLocationSerializer(location).data)


class PublicLogoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        location = get_object_or_404(Location, slug=slug)
        if not location.logo:
            return HttpResponse(status=404)
        response = HttpResponse(bytes(location.logo), content_type=location.logo_type or "image/png")
        # URL carries ?v=<timestamp>, so a new upload busts the cache.
        response["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


class PublicSubmitView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "feedback_submit"

    def post(self, request, slug):
        location = get_object_or_404(Location, slug=slug, is_active=True)
        serializer = FeedbackSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.pop("website", ""):
            return Response({"ok": True}, status=status.HTTP_201_CREATED)  # honeypot hit — drop silently
        client_id = data.get("client_id")
        if client_id and Feedback.objects.filter(client_id=client_id).exists():
            return Response({"ok": True, "duplicate": True})  # retried offline submission
        Feedback.objects.create(location=location, **data)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


# ── Admin API ───────────────────────────────────────────────────────────


class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        return visible_locations(self.request.user).annotate(
            feedback_count=Count("feedback"), last_feedback_at=Max("feedback__created_at")
        )

    @action(detail=True, methods=["post", "delete"], permission_classes=[IsAdmin], parser_classes=[MultiPartParser])
    def logo(self, request, pk=None):
        location = self.get_object()
        if request.method == "DELETE":
            location.logo, location.logo_type, location.logo_updated = None, "", None
            location.save(update_fields=["logo", "logo_type", "logo_updated"])
            return Response(LocationSerializer(location).data)
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Choose an image to upload."})
        if upload.size > MAX_LOGO_BYTES:
            raise ValidationError({"file": "Logo must be under 1 MB."})
        data = upload.read()
        mime = sniff_image(data)
        if not mime:
            raise ValidationError({"file": "Use a PNG, JPG or WebP image."})
        location.logo, location.logo_type, location.logo_updated = data, mime, timezone.now()
        location.save(update_fields=["logo", "logo_type", "logo_updated"])
        return Response(LocationSerializer(location).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def regenerate_link(self, request, pk=None):
        location = self.get_object()
        location.slug = ""
        location.save()
        return Response(LocationSerializer(location).data)


class FeedbackPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 200


class FeedbackViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = FeedbackSerializer
    pagination_class = FeedbackPagination

    def get_queryset(self):
        if self.action == "list" or self.action == "export":
            return scoped_feedback(self.request)
        return Feedback.objects.filter(location__in=visible_locations(self.request.user))

    @action(detail=False, methods=["post"])
    def mark_reviewed(self, request):
        """End-of-day sweep: every *new* entry matching the filters becomes reviewed."""
        updated = scoped_feedback(request).filter(status=Feedback.Status.NEW).update(status=Feedback.Status.REVIEWED)
        return Response({"updated": updated})

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.get_queryset()[:20000]
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="feedback.csv"'
        response.write("﻿")  # BOM so Excel renders Arabic correctly
        writer = csv.writer(response)
        cols = ["created_at", "location", "overall", *CATEGORY_FIELDS, "nps", "highlights", "comment",
                "guest_name", "guest_contact", "contact_consent", "table_number", "server_name", "language",
                "status", "staff_note"]
        writer.writerow(cols)
        tz = timezone.get_current_timezone()
        for f in qs.iterator(chunk_size=1000):
            writer.writerow([
                timezone.localtime(f.created_at, tz).strftime("%Y-%m-%d %H:%M"), f.location.name, f.overall,
                *[getattr(f, c) or "" for c in CATEGORY_FIELDS], "" if f.nps is None else f.nps,
                ", ".join(f.highlights), f.comment, f.guest_name, f.guest_contact,
                "yes" if f.contact_consent else "", f.table_number, f.server_name, f.language, f.status, f.staff_note,
            ])
        return response


class StatsView(APIView):
    def get(self, request):
        qs = scoped_feedback(request)
        start, end = date_range(request.query_params)
        span = (end - start).days + 1

        agg = qs.aggregate(
            count=Count("id"), avg=Avg("overall"),
            **{c: Avg(c) for c in CATEGORY_FIELDS},
            attention=Count("id", filter=Q(overall__lte=2, status="new")),
            followups=Count("id", filter=Q(contact_consent=True) & ~Q(status="resolved")),
            **{f"r{k}": Count("id", filter=Q(overall=k)) for k in range(1, 6)},
            **NPS_AGGREGATES,
        )

        # Same-length window immediately before, for trend deltas.
        prev_lo, prev_hi = day_bounds(start - timedelta(days=span), start - timedelta(days=1))
        prev_request_qs = scoped_feedback(request, with_dates=False).filter(created_at__gte=prev_lo, created_at__lt=prev_hi)
        prev = prev_request_qs.aggregate(count=Count("id"), avg=Avg("overall"), **NPS_AGGREGATES)

        tz = timezone.get_current_timezone()
        daily = {
            r["day"]: r
            for r in qs.annotate(day=TruncDate("created_at", tzinfo=tz)).values("day").annotate(
                count=Count("id"), avg=Avg("overall")
            )
        }
        series = []
        for i in range(span):
            d = start + timedelta(days=i)
            r = daily.get(d)
            series.append({"date": d.isoformat(), "count": r["count"] if r else 0, "avg": rounded(r["avg"]) if r else None})

        by_location = [
            {
                "id": r["location_id"],
                "name": r["location__name"],
                "count": r["count"],
                "avg": rounded(r["avg"]),
                "nps": nps_from(r),
                "low": r["low"],
            }
            for r in qs.order_by().values("location_id", "location__name").annotate(
                count=Count("id"), avg=Avg("overall"), low=Count("id", filter=Q(overall__lte=2)), **NPS_AGGREGATES
            )
        ]
        by_location.sort(key=lambda x: (-x["count"], x["name"]))

        return Response({
            "range": {"from": start.isoformat(), "to": end.isoformat()},
            "count": agg["count"],
            "avg": rounded(agg["avg"]),
            "nps": nps_from(agg),
            "nps_responses": agg["nps_n"],
            "attention": agg["attention"],
            "followups": agg["followups"],
            "distribution": {str(k): agg[f"r{k}"] for k in range(1, 6)},
            "categories": {c: rounded(agg[c]) for c in CATEGORY_FIELDS},
            "series": series,
            "highlights": [{"key": k, "count": v} for k, v in highlight_counts(qs)],
            "by_location": by_location,
            "previous": {"count": prev["count"], "avg": rounded(prev["avg"]), "nps": nps_from(prev)},
        })


class HistoryView(APIView):
    """One row per local calendar day — the 'end of day' digest list."""

    def get(self, request):
        qs = scoped_feedback(request, default_days=60)
        tz = timezone.get_current_timezone()
        days = (
            qs.annotate(day=TruncDate("created_at", tzinfo=tz))
            .values("day")
            .annotate(
                count=Count("id"),
                avg=Avg("overall"),
                low=Count("id", filter=Q(overall__lte=2)),
                new=Count("id", filter=Q(status="new")),
                comments=Count("id", filter=~Q(comment="")),
                locations=Count("location", distinct=True),
                **NPS_AGGREGATES,
            )
            .order_by("-day")
        )
        return Response([
            {
                "date": d["day"].isoformat(),
                "count": d["count"],
                "avg": rounded(d["avg"]),
                "low": d["low"],
                "new": d["new"],
                "comments": d["comments"],
                "locations": d["locations"],
                "nps": nps_from(d),
            }
            for d in days
        ])


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamMemberSerializer
    permission_classes = [IsAdmin]
    queryset = User.objects.filter(is_active=True).order_by("-is_staff", "username").prefetch_related("profile__locations")

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError({"detail": "You can't remove your own account."})
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        Token.objects.filter(user=instance).delete()
