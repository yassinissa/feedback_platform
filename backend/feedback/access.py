"""Who can see what, plus the shared feedback query filters.

Kept in one module so every endpoint (list, stats, history, export) scopes
and filters identically.
"""

from datetime import date, datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission

from .models import Feedback, Location


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


def visible_locations(user):
    if user.is_staff:
        return Location.objects.all()
    return Location.objects.filter(manager_profiles__user=user)


def parse_date(value, name):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({name: "Use YYYY-MM-DD."})


def day_bounds(start: date, end: date):
    """[start 00:00, end+1 00:00) in the app's local timezone."""
    tz = timezone.get_current_timezone()
    lo = timezone.make_aware(datetime.combine(start, time.min), tz)
    hi = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min), tz)
    return lo, hi


def date_range(params, default_days=30):
    today = timezone.localdate()
    if params.get("date"):
        d = parse_date(params["date"], "date")
        return d, d
    end = parse_date(params["to"], "to") if params.get("to") else today
    start = parse_date(params["from"], "from") if params.get("from") else end - timedelta(days=default_days - 1)
    if start > end:
        raise ValidationError({"from": "Start date is after end date."})
    return start, end


def scoped_feedback(request, *, with_dates=True, default_days=30):
    """Feedback visible to the user, filtered by the standard query params."""
    p = request.query_params
    qs = Feedback.objects.filter(location__in=visible_locations(request.user)).select_related("location")

    if p.get("location") and p["location"] != "all":
        qs = qs.filter(location_id=p["location"])
    if with_dates:
        start, end = date_range(p, default_days)
        lo, hi = day_bounds(start, end)
        qs = qs.filter(created_at__gte=lo, created_at__lt=hi)
    rating = p.get("rating")
    if rating == "low":
        qs = qs.filter(overall__lte=2)
    elif rating == "high":
        qs = qs.filter(overall__gte=4)
    elif rating and rating.isdigit():
        qs = qs.filter(overall=int(rating))
    if p.get("status") in {"new", "reviewed", "resolved"}:
        qs = qs.filter(status=p["status"])
    if p.get("followup"):
        qs = qs.filter(contact_consent=True)
    if p.get("has_comment"):
        qs = qs.exclude(comment="")
    if p.get("q"):
        term = p["q"].strip()[:100]
        qs = qs.filter(
            Q(comment__icontains=term) | Q(guest_name__icontains=term)
            | Q(server_name__icontains=term) | Q(table_number__iexact=term)
        )
    return qs
