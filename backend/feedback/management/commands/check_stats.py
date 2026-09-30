"""Read-only health check for the dashboard aggregations.

    python manage.py check_stats

Runs the stats/history queries against the configured database inside a
READ ONLY transaction and prints timings — handy after a deploy or when the
dashboard feels slow. Prints only counts, never guest details.
"""

import time
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from feedback.models import Feedback
from feedback.views import HistoryView, StatsView, highlight_counts


class Command(BaseCommand):
    help = "Time the dashboard aggregations (read-only)."

    def handle(self, *args, **opts):
        admin = get_user_model().objects.filter(is_staff=True).first()
        if admin is None:
            self.stdout.write("No admin user yet — nothing to check.")
            return
        factory = APIRequestFactory()
        today = timezone.localdate()
        with transaction.atomic():
            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY")
            self.stdout.write(f"database: {connection.vendor}, feedback rows: {Feedback.objects.count()}")
            start = time.perf_counter()
            top = highlight_counts(Feedback.objects.all(), limit=3)
            self.stdout.write(f"highlight SQL ok ({time.perf_counter() - start:.3f}s): top {len(top)} keys")
            for days in (7, 90, 365):
                frm = (today - timedelta(days=days - 1)).isoformat()
                for view, path in ((StatsView, "/api/stats/"), (HistoryView, "/api/history/")):
                    request = factory.get(path, {"from": frm, "to": today.isoformat()})
                    force_authenticate(request, user=admin)
                    start = time.perf_counter()
                    response = view.as_view()(request)
                    elapsed = time.perf_counter() - start
                    self.stdout.write(f"{view.__name__:<12} {days:>3} days -> HTTP {response.status_code} in {elapsed:.3f}s")
