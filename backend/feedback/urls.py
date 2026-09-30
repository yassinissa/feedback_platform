from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("locations", views.LocationViewSet, basename="location")
router.register("feedback", views.FeedbackViewSet, basename="feedback")
router.register("team", views.TeamViewSet, basename="team")

urlpatterns = [
    path("health/", views.health),
    path("auth/login/", views.login),
    path("auth/me/", views.me),
    path("auth/logout/", views.logout),
    path("stats/", views.StatsView.as_view()),
    path("history/", views.HistoryView.as_view()),
    path("public/locations/<slug:slug>/", views.PublicLocationView.as_view()),
    path("public/locations/<slug:slug>/feedback/", views.PublicSubmitView.as_view()),
    path("public/locations/<slug:slug>/logo/", views.PublicLogoView.as_view()),
    path("", include(router.urls)),
]
