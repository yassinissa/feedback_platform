"""Demo data so the dashboard has something to show.

Local test logins created here (dev only — change on any real deployment):
    admin   / feedback-admin-2026   (all branches)
    avenues / feedback-mgr-2026     (manager, The Avenues only)
"""

import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from feedback.models import NEGATIVE_HIGHLIGHTS, POSITIVE_HIGHLIGHTS, Feedback, Location, Profile

COMMENTS = {
    5: [
        ("en", "Amazing dinner, the lamb was perfectly cooked. Our server was so attentive!"),
        ("en", "Best brunch spot in town. We'll definitely be back next weekend."),
        ("ar", "تجربة رائعة، الأكل لذيذ جداً والخدمة ممتازة. شكراً لكم!"),
        ("en", "Lovely atmosphere and the desserts were out of this world."),
        ("ar", "المكان جميل ونظيف والموظفين محترمين جداً"),
    ],
    4: [
        ("en", "Great food, a little wait for the table but worth it."),
        ("en", "Really good experience overall. Coffee could be a bit hotter."),
        ("ar", "الأكل ممتاز بس الانتظار كان طويل شوي"),
    ],
    3: [
        ("en", "Food was fine, nothing special. Music was quite loud."),
        ("ar", "التجربة عادية، الأسعار مرتفعة مقارنة بالكمية"),
        ("en", ""),
    ],
    2: [
        ("en", "Waited 40 minutes for our mains and they arrived lukewarm."),
        ("ar", "الطلب وصل غلط ونطرنا وايد عشان يتصلح"),
    ],
    1: [
        ("en", "Very disappointed. Wrong order twice and nobody apologized."),
        ("en", "Table was dirty when we sat down and the staff seemed annoyed."),
    ],
}
NAMES = ["Sara", "Ahmed", "Fatma", "Yousef", "Noura", "Omar", "Laila", "Khaled", "Mariam", "", "", ""]
SERVERS = ["Ali", "Maria", "John", "Reem", "", ""]


class Command(BaseCommand):
    help = "Seed demo branches, logins and ~45 days of feedback."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=45)

    def handle(self, *args, days, **opts):
        random.seed(7)
        User = get_user_model()
        admin, created = User.objects.get_or_create(username="admin", defaults={"is_staff": True, "is_superuser": True, "first_name": "Admin"})
        if created:
            admin.set_password("feedback-admin-2026")
            admin.save()
        Profile.objects.get_or_create(user=admin)

        branches = [
            ("The Avenues", "الأفنيوز", "Kuwait City", 4.4),
            ("Marina Mall", "مارينا مول", "Salmiya", 4.0),
            ("360 Mall", "مول ٣٦٠", "Zahra", 3.5),
        ]
        locations = []
        for name, name_ar, city, _ in branches:
            loc, _ = Location.objects.get_or_create(name=name, defaults={"name_ar": name_ar, "city": city})
            locations.append(loc)

        mgr, created = User.objects.get_or_create(username="avenues", defaults={"first_name": "Avenues Manager"})
        if created:
            mgr.set_password("feedback-mgr-2026")
            mgr.save()
        profile, _ = Profile.objects.get_or_create(user=mgr)
        profile.locations.set([locations[0]])

        if Feedback.objects.exists():
            self.stdout.write("Feedback already present — skipping feedback seed.")
            return

        now = timezone.now()
        batch = []
        for loc, (_, _, _, mean) in zip(locations, branches):
            for day in range(days):
                for _ in range(random.randint(3, 11)):
                    overall = max(1, min(5, round(random.gauss(mean, 0.9))))
                    lang, comment = random.choice(COMMENTS[overall])
                    pool = POSITIVE_HIGHLIGHTS if overall >= 4 else NEGATIVE_HIGHLIGHTS
                    cat = lambda: max(1, min(5, overall + random.choice([-1, 0, 0, 1]))) if random.random() > 0.25 else None
                    name = random.choice(NAMES)
                    ts = now - timedelta(days=day, hours=random.randint(0, 11), minutes=random.randint(0, 59))
                    batch.append(Feedback(
                        location=loc, overall=overall, food=cat(), service=cat(), ambiance=cat(),
                        cleanliness=cat(), value=cat(),
                        nps=max(0, min(10, overall * 2 + random.choice([-2, -1, 0, 0, 1]))) if random.random() > 0.2 else None,
                        highlights=random.sample(pool, k=random.randint(0, 3)), comment=comment, language=lang,
                        guest_name=name, guest_contact=f"+965 5{random.randint(1000000, 9999999)}" if name and overall <= 2 else "",
                        contact_consent=bool(name and overall <= 2), table_number=str(random.randint(1, 30)) if random.random() > 0.4 else "",
                        server_name=random.choice(SERVERS),
                        status="new" if day < 3 else random.choice(["reviewed", "resolved", "resolved"]),
                    ))
                    batch[-1]._ts = ts
        Feedback.objects.bulk_create(batch)
        # auto_now_add ignores provided values, so backdate after insert.
        created = list(Feedback.objects.order_by("id"))
        for obj, src in zip(created, batch):
            obj.created_at = src._ts
        Feedback.objects.bulk_update(created, ["created_at"], batch_size=500)
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(batch)} feedback entries across {len(locations)} branches."))
