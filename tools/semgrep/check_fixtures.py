"""Assert that each project Semgrep rule fires on its fixture and stays quiet on clean code.

Usage: semgrep scan --json ... tests/fixtures/semgrep/*.ts > out.json && python3 tools/semgrep/check_fixtures.py out.json
"""
import json
import sys

EXPECTED = {
    ("violations.ts", "kometa-no-html-injection"): 1,
    ("violations.ts", "kometa-no-dynamic-code"): 2,
    ("violations.ts", "kometa-postmessage-wildcard-origin"): 1,
    ("violations.ts", "kometa-message-listener-checks-origin"): 1,
}

report = json.load(open(sys.argv[1], encoding="utf-8"))
if report.get("errors"):
    sys.exit(f"semgrep reported errors: {report['errors']}")

found: dict[tuple[str, str], int] = {}
for result in report["results"]:
    key = (result["path"].rsplit("/", 1)[-1], result["check_id"].rsplit(".", 1)[-1])
    found[key] = found.get(key, 0) + 1

if found != EXPECTED:
    sys.exit(f"semgrep fixture mismatch\n expected: {sorted(EXPECTED.items())}\n found:    {sorted(found.items())}")
print(f"semgrep fixtures OK: {sum(EXPECTED.values())} expected findings, clean file quiet")
