import json

from django.core.management.base import BaseCommand

from apps.core.quality import run_checks


class Command(BaseCommand):
    help = (
        "Run Zpot data-quality checks (observations, sources, verification, geometry, windows, tariffs, corrections)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **opts):
        r = run_checks()
        if opts["json"]:
            self.stdout.write(json.dumps(r, indent=2))
            return
        if not r["issues"]:
            self.stdout.write(self.style.SUCCESS("No data-quality issues found."))
        for i in r["issues"]:
            style = self.style.ERROR if i["severity"] == "high" else self.style.WARNING
            self.stdout.write(style(f"[{i['severity']}] {i['code']}: {i['count']} — {i['detail']} {i['sample']}"))
