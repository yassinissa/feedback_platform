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
