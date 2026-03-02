# Data Model: Load Test Seed & Stage Config

**Feature**: 010-locust-load-testing | **Date**: 2026-02-26

This document describes the **test data** and **configuration** used by the load-test harness. It does not redefine the application’s domain model (Merchant, Coupon, Redemption); it describes how seed data and stage parameters are structured for the four test stages.

---

## 1. Seed data (versioned initial state)

The versioned seed produces the “known initial state” before each stage. It creates (or restores) the following **test entities** used by Locust and by the consistency checks.

### 1.1 Test merchants

| Attribute   | Description |
|------------|-------------|
| Count      | 1 (Stages 1–2) or 50 (Stages 3–4); parameter to seed script |
| Identity   | Stable IDs/names so APIs and DB checks can target them |
| Coupons    | Each merchant has coupons; see below |

### 1.2 Test coupons (per merchant)

| Attribute     | Description |
|---------------|-------------|
| Quantity     | Some coupons have limited quantity (for oversell and idempotency tests); quantity is fixed per seed run |
| One-per-user | At most one successful redemption per coupon_id (enforced by app; seed does not create redemptions) |

Seed must create enough coupons (and limited-quantity coupons) so that Stage 2 idempotency tests can target the same `coupon_id` from multiple virtual users.

### 1.3 Test users (auth pool)

| Attribute | Description |
|-----------|-------------|
| Count      | At least as many as the max virtual users for the stage (e.g. 200, 1000, 1500, 5000); seed creates a pool; each Locust user is assigned one |
| Credentials | Each test user has login credentials (e.g. phone/email + password or token) so that each virtual user authenticates with its own identity |
| Role       | Consumer (or appropriate role) so they can browse and redeem coupons |

Seed output (or a side-car file) must expose the list of credentials (or tokens) so the Locust harness can assign one per `HttpUser`.

### 1.4 Redemptions

Not part of seed. Redemptions are created only during the load test. Reset clears all redemptions; seed does not create them.

---

## 2. Stage configuration

Each stage has a fixed configuration used by the runner and Locust.

| Parameter      | Stage 1      | Stage 2           | Stage 3   | Stage 4   |
|----------------|-------------|-------------------|-----------|-----------|
| Merchants      | 1           | 1                 | 50        | 50        |
| Users (target) | 200         | 200 → 1000 (ramp) | 1500      | 5000      |
| Ramp           | —           | +100 users / 30 s | —         | —         |
| Run time       | Configurable (e.g. 5–10 min) | Same | Same      | Same      |
| Stop condition | —           | —                 | —         | Error rate &gt; 5% |
| Spawn rate     | Configurable | 100/30s implied   | Configurable | Configurable |

These are the minimum parameters the runner must support; they can be overridden via config or env (see contracts).

---

## 3. Consistency-check inputs

Post-run consistency checks query the **application** database (staging). They do not have a separate data model; they read:

- Redemption records (count per coupon, status, per-merchant aggregates)
- Dashboard API responses (or DB-backed aggregates for click counts, redemption counts, exchange history)

Validation rules are in the spec (Data-Consistency Verification Rules). The consistency script receives (or discovers) DB connection info and optionally the list of request IDs or success responses from the load test if we correlate “API 200” with DB records.

---

## 4. Artifact output (no persistent model)

Latency, error rate, and breakpoint data are written to **artifacts** (e.g. CSV, HTML) in a defined output directory. They are not stored in a database; they are files produced by Locust and optionally by the consistency script (e.g. a small JSON/CSV summary of consistency results).
