# Research: CouPro Load Testing (Locust)

**Feature**: 010-locust-load-testing | **Date**: 2026-02-26

## 1. Per-user authentication (test user pool)

**Decision**: Pre-create a pool of test users (or tokens) and assign one credential per Locust `HttpUser` instance. Each user authenticates once in `on_start()` and reuses the token for all tasks.

**Rationale**: Spec requires "one identity per virtual user" and "no single shared token." Locust’s `on_start()` runs once per user instance, so we can either (a) have each user log in in `on_start()` using a pre-created account from the seed, or (b) pre-fetch tokens (e.g. via a script) and pass a token per user into the locustfile (e.g. via environment or a shared pool that each user pops from in `on_start()`). Option (a) matches “pre-created pool of test users” and keeps seed as the source of truth; option (b) is valid if we pre-create tokens and store them in a file or env. We choose (a): seed creates N test users; Locust receives a list of (username/password or user_id) and each `HttpUser` is assigned one and logs in in `on_start()`.

**Alternatives considered**: Single shared token (rejected: spec forbids). Dynamic registration during test (rejected: adds load and doesn’t match “pre-created pool”).

---

## 2. Same automation for load test and consistency checks

**Decision**: Use a single runner script (e.g. shell or Python) that runs in order: (1) reset (clear redemptions + re-run seed or restore snapshot), (2) run Locust for the stage, (3) run consistency-check script (DB queries). Optionally use Locust’s `test_stop` event to trigger consistency checks only if the runner is a single process; otherwise the runner script is the single automation that runs both.

**Rationale**: Spec requires “the same automation that runs the load test MUST run these consistency checks (e.g. teardown or follow-up step in the same runner/script).” A wrapper script is the clearest way to guarantee one automation: it runs reset → Locust → consistency checks. Locust’s `test_stop` can call a Python function that runs DB checks when Locust is run as a library; when Locust is run via CLI, the wrapper runs the consistency script after `locust` exits. Prefer wrapper so consistency logic stays outside Locust and can use Django ORM or a DB client without coupling to Locust’s process.

**Alternatives considered**: Only `test_stop` inside Locust (acceptable if running as library; wrapper is more portable). Separate CI jobs for load and checks (rejected: spec says same automation).

---

## 3. Test output artifacts and location

**Decision**: Use Locust’s built-in `--csv <prefix>` and `--html <path>` to write artifacts. Define a single output directory (e.g. `LOAD_TEST_OUTPUT_DIR` or `--output-dir`) and pass it into the runner so that all artifacts (CSV stats, CSV history, HTML report) are written under that directory. Format is not prescribed beyond “at least one machine-readable or viewable artifact”; CSV + HTML satisfies that.

**Rationale**: Spec requires “at least one machine-readable or viewable artifact (e.g. HTML report, CSV, or JSON) in a defined output location.” Locust provides `--csv` and `--html`; CSV is machine-readable, HTML is viewable. No need for custom JSON unless we add a small exporter. Document the output directory in config and quickstart.

**Alternatives considered**: JSON only (Locust has no built-in JSON file export; would need custom export). Console only (rejected: spec requires artifact in defined location).

---

## 4. Versioned seed and reset

**Decision**: Implement the “known initial state” with a versioned seed: (a) Django fixtures (e.g. `loaddata`) or (b) a Django management command that creates merchants, coupons, and test users from a fixed dataset (e.g. YAML/JSON or code). Reset = delete (or truncate) redemptions + re-run the seed so that merchant/coupon/user data is recreated to the same state. Option (b) is easier to version and parameterize (e.g. 1 merchant vs 50) and avoids fixture ID collisions; prefer management command that creates N merchants, M coupons per merchant, and P test users.

**Rationale**: Spec says “one versioned seed (script or fixture) defines initial state; reset = clear redemptions + re-run that seed (or restore DB to post-seed snapshot).” A management command keeps seed in code and makes “1 merchant” vs “50 merchants” a parameter; fixtures are a valid alternative if we maintain separate fixture files per stage. Restore from post-seed snapshot is an alternative for very large seeds; for 50 merchants we assume re-run seed is acceptable.

**Alternatives considered**: Restore from DB snapshot only (acceptable; not required). Fixtures only (acceptable; management command preferred for parameterization).

---

## 5. Stop at 5% error rate (Stage 4)

**Decision**: Use Locust’s `--run-time` and a custom failure-rate check, or run Locust as a library and poll `environment.stats.total.fail_ratio` (or equivalent); when fail_ratio exceeds 0.05, call `environment.runner.quit()`. Document in quickstart that Stage 4 is configured to stop when error rate exceeds 5%.

**Rationale**: Spec requires the test to stop when error rate exceeds 5% so the staging DB is not hammered. Locust does not have a built-in “stop on failure rate” flag; we implement it via the `request` or `failure` event to update failure count and total, then quit the runner when the ratio exceeds the threshold, or run in short windows and check after each window.

**Alternatives considered**: Rely only on `--run-time` (rejected: would not stop early at 5%). External monitor that kills the process (fragile; in-process check preferred).
