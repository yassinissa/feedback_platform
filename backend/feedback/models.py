import secrets
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify

RATING = [MinValueValidator(1), MaxValueValidator(5)]

# Keys the guest form can send as "what stood out". Labels live in the
# frontend (EN + AR); the backend only validates membership.
POSITIVE_HIGHLIGHTS = [
    "tasty_food",
    "friendly_staff",
    "fast_service",
    "great_atmosphere",
    "spotless",
    "good_value",
    "beautiful_presentation",
]
NEGATIVE_HIGHLIGHTS = [
    "slow_service",
    "food_temperature",
    "wrong_order",
    "noisy",
    "cleanliness",
    "pricey",
    "staff_attitude",
]
ALL_HIGHLIGHTS = set(POSITIVE_HIGHLIGHTS + NEGATIVE_HIGHLIGHTS)
CATEGORY_FIELDS = ["food", "service", "ambiance", "cleanliness", "value"]
# What the current guest form asks for. cleanliness/value remain for older entries.
GUEST_CATEGORIES = ["food", "service", "ambiance"]


class Location(models.Model):
    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=80, blank=True)
    # Public URL key for the iPad/QR link. Random suffix so links aren't guessable.
    slug = models.SlugField(max_length=80, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Logo lives in the database: Render's disk is wiped on every deploy.
    # The admin resizes it in the browser (≤512px) before upload, so rows stay small.
    logo = models.BinaryField(null=True, blank=True, editable=False)
    logo_type = models.CharField(max_length=20, blank=True)
    logo_updated = models.DateTimeField(null=True, blank=True)
    # Tile behind the logo on the guest screen — "dark" for white/light logos.
    logo_bg = models.CharField(max_length=5, choices=[("light", "Light"), ("dark", "Dark")], default="light")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def logo_url(self):
        if not self.logo or not self.logo_updated:
            return None
        return f"/api/public/locations/{self.slug}/logo/?v={int(self.logo_updated.timestamp())}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:50] or "branch"
            self.slug = f"{base}-{secrets.token_hex(3)}"
        super().save(*args, **kwargs)


class Profile(models.Model):
    """Branch managers are scoped to their locations. Staff users are admins."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    locations = models.ManyToManyField(Location, blank=True, related_name="manager_profiles")

    def __str__(self):
        return f"Profile({self.user})"


class Feedback(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        REVIEWED = "reviewed", "Reviewed"
        RESOLVED = "resolved", "Resolved"

    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="feedback")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # Lets the iPad retry a queued submission without creating duplicates.
    client_id = models.UUIDField(default=uuid.uuid4, unique=True)

    overall = models.PositiveSmallIntegerField(validators=RATING)
    food = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    service = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    ambiance = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    cleanliness = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    value = models.PositiveSmallIntegerField(null=True, blank=True, validators=RATING)
    nps = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(10)]
    )
    highlights = models.JSONField(default=list, blank=True)
    comment = models.TextField(blank=True, max_length=2000)

    guest_name = models.CharField(max_length=80, blank=True)
    guest_contact = models.CharField(max_length=120, blank=True)
    contact_consent = models.BooleanField(default=False)
    table_number = models.CharField(max_length=20, blank=True)
    server_name = models.CharField(max_length=60, blank=True)
    language = models.CharField(max_length=5, default="en")

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW, db_index=True)
    staff_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["location", "-created_at"])]

    def __str__(self):
        return f"{self.location} · {self.overall}★ · {self.created_at:%Y-%m-%d}"
