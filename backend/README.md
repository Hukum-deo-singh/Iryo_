# Iryo backend

Java 21, Spring Boot, PostgreSQL (Aiven), Flyway.

## First time (from the repo root)
```bash
bash backend/setup.sh                   # creates pom.xml and mvnw, adds the libraries
cp backend/.env.example backend/.env    # then open backend/.env and fill in every PASTE_ value
./backend/mvnw -f backend/pom.xml test  # unit tests, no database needed
```

## Run
```bash
set -a; source backend/.env; set +a
./backend/mvnw -f backend/pom.xml spring-boot:run
bash backend/smoke-test.sh              # in a second terminal: checks the whole flow
```
Flyway creates the tables by itself on first start. Never edit a migration that has already run. Add a new `V4__...sql` instead.

## Docs
- `docs/API_CONTRACT.md`: every route and field.
- `docs/RENDER.md`: hosting on Render's free plan, cold starts, cron job, Node-RED.
- `docs/DERIVED_DATA_RULES.md`: the health thresholds. They are provisional and need clinical review.
