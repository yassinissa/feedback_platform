import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from feedback.models import Profile


class Command(BaseCommand):
    help = "Create the first admin from DJANGO_ADMIN_USERNAME / DJANGO_ADMIN_PASSWORD if it doesn't exist."

    def handle(self, *args, **opts):
        username = os.environ.get("DJANGO_ADMIN_USERNAME")
        password = os.environ.get("DJANGO_ADMIN_PASSWORD")
        if not username or not password:
            self.stdout.write("DJANGO_ADMIN_USERNAME/PASSWORD not set — skipping admin creation.")
            return
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"Admin '{username}' already exists.")
            return
        user = User.objects.create_superuser(username=username, password=password, email="")
        Profile.objects.get_or_create(user=user)
        self.stdout.write(self.style.SUCCESS(f"Created admin '{username}'."))
