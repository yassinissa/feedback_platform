from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ALL_HIGHLIGHTS, Feedback, Location, Profile

User = get_user_model()


class LocationSerializer(serializers.ModelSerializer):
    feedback_count = serializers.IntegerField(read_only=True, default=0)
    last_feedback_at = serializers.DateTimeField(read_only=True, default=None)

    class Meta:
        model = Location
        fields = ["id", "name", "name_ar", "city", "slug", "is_active", "created_at", "feedback_count", "last_feedback_at"]
        read_only_fields = ["slug", "created_at"]


class PublicLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ["name", "name_ar", "city", "slug"]


class FeedbackSubmitSerializer(serializers.ModelSerializer):
    # Honeypot: real guests never see this field; bots fill it.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Feedback
        fields = [
            "client_id", "overall", "food", "service", "ambiance", "cleanliness", "value", "nps",
            "highlights", "comment", "guest_name", "guest_contact", "contact_consent",
            "table_number", "server_name", "language", "website",
        ]
        extra_kwargs = {"client_id": {"validators": []}}

    def validate_highlights(self, value):
        if not isinstance(value, list) or len(value) > 14:
            raise serializers.ValidationError("Invalid highlights.")
        unknown = set(value) - ALL_HIGHLIGHTS
        if unknown:
            raise serializers.ValidationError(f"Unknown highlights: {', '.join(sorted(unknown))}")
        return list(dict.fromkeys(value))

    def validate_language(self, value):
        return value if value in {"en", "ar"} else "en"

    def validate(self, attrs):
        if attrs.get("contact_consent") and not attrs.get("guest_contact", "").strip():
            raise serializers.ValidationError({"guest_contact": "Add a phone or email so we can reach you."})
        return attrs


class FeedbackSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source="location.name", read_only=True)

    class Meta:
        model = Feedback
        fields = [
            "id", "location", "location_name", "created_at", "overall", "food", "service", "ambiance",
            "cleanliness", "value", "nps", "highlights", "comment", "guest_name", "guest_contact",
            "contact_consent", "table_number", "server_name", "language", "status", "staff_note",
        ]
        read_only_fields = [f for f in fields if f not in {"status", "staff_note"}]


class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    location_ids = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "location_ids"]

    def get_role(self, user):
        return "admin" if user.is_staff else "manager"

    def get_name(self, user):
        return user.get_full_name() or user.username

    def get_location_ids(self, user):
        profile = getattr(user, "profile", None)
        return list(profile.locations.values_list("id", flat=True)) if profile else []


class TeamMemberSerializer(MeSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    role_input = serializers.ChoiceField(choices=["admin", "manager"], write_only=True, required=False, source="role")
    locations = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), many=True, write_only=True, required=False
    )
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    class Meta(MeSerializer.Meta):
        fields = MeSerializer.Meta.fields + ["first_name", "password", "role_input", "locations", "last_login"]
        read_only_fields = ["last_login"]

    def _apply(self, user, data):
        role = data.pop("role", None)
        locations = data.pop("locations", None)
        password = data.pop("password", None)
        for key, val in data.items():
            setattr(user, key, val)
        if role is not None:
            user.is_staff = role == "admin"
        if password:
            user.set_password(password)
        user.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        if locations is not None:
            profile.locations.set(locations)
        return user

    def create(self, validated_data):
        if not validated_data.get("password"):
            raise serializers.ValidationError({"password": "Set a password of at least 8 characters."})
        return self._apply(User(), validated_data)

    def update(self, instance, validated_data):
        return self._apply(instance, validated_data)
