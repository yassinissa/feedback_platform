import uuid

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Feedback, Location, Profile

User = get_user_model()


class PublicSubmitTests(APITestCase):
    def setUp(self):
        self.loc = Location.objects.create(name="Avenues")
        self.url = f"/api/public/locations/{self.loc.slug}/feedback/"

    def test_submit_and_retry_is_idempotent(self):
        payload = {"overall": 4, "highlights": ["tasty_food"], "comment": "Nice", "client_id": str(uuid.uuid4())}
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 201)
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 200)
        self.assertEqual(Feedback.objects.count(), 1)

    def test_rejects_bad_rating_and_unknown_highlight(self):
        res = self.client.post(self.url, {"overall": 6, "highlights": ["nope"]}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("overall", res.data)
        self.assertIn("highlights", res.data)

    def test_honeypot_is_silently_dropped(self):
        res = self.client.post(self.url, {"overall": 5, "website": "http://spam"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Feedback.objects.count(), 0)

    def test_paused_branch_is_hidden(self):
        self.loc.is_active = False
        self.loc.save()
        self.assertEqual(self.client.get(f"/api/public/locations/{self.loc.slug}/").status_code, 404)


class ScopingTests(APITestCase):
    def setUp(self):
        self.a = Location.objects.create(name="A")
        self.b = Location.objects.create(name="B")
        Feedback.objects.create(location=self.a, overall=5)
        Feedback.objects.create(location=self.b, overall=1)
        self.manager = User.objects.create_user("mgr", password="pass12345")
        Profile.objects.create(user=self.manager).locations.set([self.a])

    def test_manager_sees_only_their_branch(self):
        self.client.force_authenticate(self.manager)
        self.assertEqual([l["name"] for l in self.client.get("/api/locations/").data], ["A"])
        self.assertEqual(self.client.get("/api/stats/").data["count"], 1)
        self.assertEqual(self.client.get("/api/feedback/").data["count"], 1)

    def test_manager_cannot_create_branches_or_manage_team(self):
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.post("/api/locations/", {"name": "C"}).status_code, 403)
        self.assertEqual(self.client.get("/api/team/").status_code, 403)

    def test_mark_reviewed_only_touches_new(self):
        admin = User.objects.create_user("admin", password="pass12345", is_staff=True)
        self.client.force_authenticate(admin)
        res = self.client.post("/api/feedback/mark_reviewed/")
        self.assertEqual(res.data["updated"], 2)
        self.assertFalse(Feedback.objects.filter(status="new").exists())


class SimpleFormTests(APITestCase):
    def setUp(self):
        self.loc = Location.objects.create(name="Avenues")
        self.url = f"/api/public/locations/{self.loc.slug}/feedback/"

    def test_overall_is_rounded_mean_of_three_ratings(self):
        self.client.post(self.url, {"food": 5, "service": 4, "ambiance": 4}, format="json")
        self.assertEqual(Feedback.objects.get().overall, 4)  # 4.33 -> 4

    def test_needs_at_least_one_rating(self):
        res = self.client.post(self.url, {"comment": "hi"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("overall", res.data)


class LogoTests(APITestCase):
    PNG = bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
    )

    def setUp(self):
        self.loc = Location.objects.create(name="Avenues")
        self.admin = User.objects.create_user("admin", password="pass12345", is_staff=True)
        self.client.force_authenticate(self.admin)

    def upload(self, data, name="logo.png"):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return self.client.post(f"/api/locations/{self.loc.id}/logo/", {"file": SimpleUploadedFile(name, data)}, format="multipart")

    def test_upload_and_serve(self):
        res = self.upload(self.PNG)
        self.assertEqual(res.status_code, 200)
        url = res.data["logo_url"]
        self.client.force_authenticate(None)
        public = self.client.get(f"/api/public/locations/{self.loc.slug}/").data
        self.assertEqual(public["logo_url"], url)
        img = self.client.get(url)
        self.assertEqual(img["Content-Type"], "image/png")
        self.assertEqual(img.content, self.PNG)

    def test_rejects_svg_and_non_images(self):
        self.assertEqual(self.upload(b"<svg onload=alert(1)>", "x.svg").status_code, 400)
        self.assertEqual(self.upload(b"hello", "x.png").status_code, 400)

    def test_manager_cannot_upload(self):
        mgr = User.objects.create_user("mgr", password="pass12345")
        self.client.force_authenticate(mgr)
        self.assertIn(self.upload(self.PNG).status_code, (403, 404))


class InstallAsAppTests(APITestCase):
    def setUp(self):
        self.loc = Location.objects.create(name="The Avenues <b>")

    def test_branch_icon_is_png_of_requested_size(self):
        from io import BytesIO

        from PIL import Image

        res = self.client.get(f"/api/public/locations/{self.loc.slug}/icon-180.png")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Image.open(BytesIO(res.content)).size, (180, 180))
        self.assertEqual(self.client.get(f"/api/public/locations/{self.loc.slug}/icon-999.png").status_code, 404)

    def test_manifest_starts_at_branch_form(self):
        data = self.client.get(f"/api/public/locations/{self.loc.slug}/manifest.webmanifest").json()
        self.assertEqual(data["start_url"], f"/f/{self.loc.slug}")
        self.assertEqual(data["display"], "standalone")

    def test_guest_page_head_tags_are_branch_specific_and_escaped(self):
        from feedback.app_install import guest_head_tags

        tags = guest_head_tags(self.loc.slug)
        self.assertIn(f"/api/public/locations/{self.loc.slug}/manifest.webmanifest", tags)
        self.assertIn("apple-touch-icon", tags)
        self.assertNotIn("<b>", tags)
        self.assertIsNone(guest_head_tags("missing-branch"))


class StatsAggregationTests(APITestCase):
    """Dashboard numbers come from SQL aggregates; check them against plain Python."""

    def setUp(self):
        from collections import Counter

        self.Counter = Counter
        a, b = Location.objects.create(name="A"), Location.objects.create(name="B")
        data = [
            (a, 5, 10, ["tasty_food"]), (a, 4, 9, []), (a, 2, 3, ["slow_service", "noisy"]),
            (b, 1, 0, ["slow_service"]), (b, 3, None, ["noisy", "pricey"]), (b, 5, 8, []),
        ]
        for loc, overall, nps, hl in data:
            Feedback.objects.create(location=loc, overall=overall, nps=nps, highlights=hl)
        self.data = data
        admin = User.objects.create_user("admin", password="pass12345", is_staff=True)
        self.client.force_authenticate(admin)

    def test_stats_match_python_reference(self):
        s = self.client.get("/api/stats/").json()
        self.assertEqual(s["count"], 6)
        self.assertEqual(s["distribution"], {"1": 1, "2": 1, "3": 1, "4": 1, "5": 2})
        scores = [n for *_, n, _ in self.data if n is not None]
        expected_nps = round((sum(n >= 9 for n in scores) - sum(n <= 6 for n in scores)) * 100 / len(scores))
        self.assertEqual(s["nps"], expected_nps)
        self.assertEqual(s["nps_responses"], 5)
        expected_hl = self.Counter(h for *_, hl in self.data for h in hl)
        self.assertEqual({h["key"]: h["count"] for h in s["highlights"]}, dict(expected_hl))
        by = {b["name"]: b for b in s["by_location"]}
        self.assertEqual(by["A"]["count"], 3)
        self.assertEqual(by["B"]["low"], 1)
        self.assertEqual(by["A"]["avg"], round(11 / 3, 2))

    def test_history_nps_per_day(self):
        days = self.client.get("/api/history/").json()
        self.assertEqual(len(days), 1)
        self.assertEqual(days[0]["count"], 6)
        self.assertEqual(days[0]["nps"], self.client.get("/api/stats/").json()["nps"])

    def test_check_stats_command_runs(self):
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        call_command("check_stats", stdout=out)
        self.assertIn("HTTP 200", out.getvalue())
