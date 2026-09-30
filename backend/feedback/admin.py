from django.contrib import admin

from .models import Feedback, Location, Profile


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "slug", "is_active", "created_at"]
    search_fields = ["name", "city"]


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ["created_at", "location", "overall", "nps", "guest_name", "status"]
    list_filter = ["location", "overall", "status"]
    search_fields = ["comment", "guest_name"]


admin.site.register(Profile)
