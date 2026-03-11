"""
Post-run consistency check for load tests.
Verifies (a) no oversell, (b) at most one success per coupon_id (exclusive),
(c) per-merchant sums = platform total, (d) API success implies DB record,
(e) dashboard vs DB aggregation. Outputs pass/fail and optional summary to OUTPUT_DIR.
"""
import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand

from api.load_test_consistency import verify_load_test_consistency


class Command(BaseCommand):
    help = "Verify load test consistency: no oversell, no duplicate redemption, isolation, API/DB match, dashboard/DB match."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            type=str,
            default=None,
            help="Directory for consistency summary (default: OUTPUT_DIR env).",
        )

    def handle(self, *args, **options):
        output_dir = options.get("output_dir") or os.environ.get(
            "OUTPUT_DIR", "./load-test-results"
        )
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        result = verify_load_test_consistency()
        summary_file = out_path / "consistency_summary.json"
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        if not result["passed"]:
            for e in result["errors"]:
                self.stdout.write(self.style.ERROR(e))
            self.stdout.write(
                self.style.ERROR(
                    f"Consistency check FAILED ({len(result['errors'])} errors)."
                )
            )
            self.exit(1)
        self.stdout.write(
            self.style.SUCCESS(
                f"Consistency check passed. Summary: {summary_file}"
            )
        )
