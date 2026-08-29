#!/usr/bin/env bash
set -euo pipefail

# SQLite and its rate-limit ledger are the authoritative product store. Keep one
# serving replica so every request reaches the same database after the factory's
# standard container deployment creates or updates the app.
resource_group="${1:-sociobot}"
app_name="${2:-sf-guest-booking-confirm}"
wait_attempts="${REPLICA_WAIT_ATTEMPTS:-60}"
wait_seconds="${REPLICA_WAIT_SECONDS:-2}"

if [[ ! "$wait_attempts" =~ ^[1-9][0-9]*$ || ! "$wait_seconds" =~ ^[0-9]+$ ]]; then
  printf 'Replica wait settings must be non-negative integers, with at least one attempt.\n' >&2
  exit 2
fi

az containerapp update \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --min-replicas 1 \
  --max-replicas 1 \
  --output none

az containerapp revision set-mode \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --mode single \
  --output none

actual_min=""
actual_max=""
active_revisions=""
running_replicas=""
for ((attempt = 1; attempt <= wait_attempts; attempt += 1)); do
  actual_min="$(az containerapp show \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --query 'properties.template.scale.minReplicas' \
    --output tsv)"
  actual_max="$(az containerapp show \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --query 'properties.template.scale.maxReplicas' \
    --output tsv)"
  latest_revision="$(az containerapp show \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --query 'properties.latestReadyRevisionName' \
    --output tsv)"
  active_revisions="$(az containerapp revision list \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --query 'length([?properties.active])' \
    --output tsv)"
  running_replicas="$(az containerapp replica list \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --revision "$latest_revision" \
    --query "length([?properties.runningState == 'Running'])" \
    --output tsv 2>/dev/null || true)"

  if [[ "$actual_min" == "1" && "$actual_max" == "1" && "$active_revisions" == "1" && "$running_replicas" == "1" ]]; then
    printf 'Verified %s uses one active revision and one running replica (min=1, max=1).\n' "$app_name"
    exit 0
  fi

  if ((attempt < wait_attempts)); then
    sleep "$wait_seconds"
  fi
done

printf 'Single-replica convergence failed for %s: min=%s max=%s active_revisions=%s running_replicas=%s.\n' \
  "$app_name" "$actual_min" "$actual_max" "$active_revisions" "$running_replicas" >&2
exit 1
