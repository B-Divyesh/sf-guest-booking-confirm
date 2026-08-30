#!/usr/bin/env bash
set -euo pipefail

# The Container App template is only a desired state. Verify the revision that
# currently receives traffic as well, because SQLite and its rate-limit ledger
# are correct only when the serving process has the Azure Files /data mount and
# there is exactly one process using it.
resource_group="${1:-sociobot}"
app_name="${2:-sf-guest-booking-confirm}"
expected_image="${3:-}"
storage_name="${AZURE_ENV_STORAGE_NAME:-guest-booking-confirm-data}"
volume_name="gbc-data"
mount_path="/data"
wait_attempts="${TOPOLOGY_WAIT_ATTEMPTS:-60}"
wait_seconds="${TOPOLOGY_WAIT_SECONDS:-2}"

command -v jq >/dev/null || {
  printf 'jq is required to verify the serving Container App revision.\n' >&2
  exit 2
}
if [[ -z "$expected_image" ]]; then
  printf 'Usage: %s <resource-group> <app-name> <expected-image>\n' "$0" >&2
  exit 2
fi
if [[ ! "$wait_attempts" =~ ^[1-9][0-9]*$ || ! "$wait_seconds" =~ ^[0-9]+$ ]]; then
  printf 'Topology wait settings must be non-negative integers, with at least one attempt.\n' >&2
  exit 2
fi

actual_image=""
actual_min=""
actual_max=""
template_volumes="0"
template_mounts="0"
provisioning_state=""
latest_revision=""
active_revisions=""
running_replicas=""
revision_image=""
revision_min=""
revision_max=""
revision_volumes="0"
revision_mounts="0"
revision_active=""

for ((attempt = 1; attempt <= wait_attempts; attempt += 1)); do
  app_json="$(az containerapp show \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --output json)"
  actual_image="$(jq -r '.properties.template.containers[0].image // ""' <<<"$app_json")"
  actual_min="$(jq -r '.properties.template.scale.minReplicas // ""' <<<"$app_json")"
  actual_max="$(jq -r '.properties.template.scale.maxReplicas // ""' <<<"$app_json")"
  template_volumes="$(jq -r \
    --arg storage_name "$storage_name" \
    --arg volume_name "$volume_name" \
    '[.properties.template.volumes[]? | select(.name == $volume_name and .storageName == $storage_name and .storageType == "AzureFile")] | length' <<<"$app_json")"
  template_mounts="$(jq -r \
    --arg volume_name "$volume_name" \
    --arg mount_path "$mount_path" \
    '[.properties.template.containers[0].volumeMounts[]? | select(.volumeName == $volume_name and .mountPath == $mount_path)] | length' <<<"$app_json")"
  provisioning_state="$(jq -r '.properties.provisioningState // ""' <<<"$app_json")"
  latest_revision="$(jq -r '.properties.latestReadyRevisionName // ""' <<<"$app_json")"
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

  revision_json="$(az containerapp revision show \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --revision "$latest_revision" \
    --output json 2>/dev/null || true)"
  if [[ -n "$revision_json" ]]; then
    revision_image="$(jq -r '.properties.template.containers[0].image // ""' <<<"$revision_json")"
    revision_min="$(jq -r '.properties.template.scale.minReplicas // ""' <<<"$revision_json")"
    revision_max="$(jq -r '.properties.template.scale.maxReplicas // ""' <<<"$revision_json")"
    revision_volumes="$(jq -r \
      --arg storage_name "$storage_name" \
      --arg volume_name "$volume_name" \
      '[.properties.template.volumes[]? | select(.name == $volume_name and .storageName == $storage_name and .storageType == "AzureFile")] | length' <<<"$revision_json")"
    revision_mounts="$(jq -r \
      --arg volume_name "$volume_name" \
      --arg mount_path "$mount_path" \
      '[.properties.template.containers[0].volumeMounts[]? | select(.volumeName == $volume_name and .mountPath == $mount_path)] | length' <<<"$revision_json")"
    revision_active="$(jq -r '.properties.active // false' <<<"$revision_json")"
  fi

  if [[ "$actual_image" == "$expected_image" \
    && "$actual_min" == "1" && "$actual_max" == "1" \
    && "$template_volumes" == "1" && "$template_mounts" == "1" \
    && "$provisioning_state" == "Succeeded" \
    && "$active_revisions" == "1" && "$running_replicas" == "1" \
    && "$revision_image" == "$expected_image" \
    && "$revision_min" == "1" && "$revision_max" == "1" \
    && "$revision_volumes" == "1" && "$revision_mounts" == "1" \
    && "$revision_active" == "true" ]]; then
    printf 'Verified serving revision %s: image=%s, Azure Files /data, one active revision, one running replica.\n' \
      "$latest_revision" "$expected_image"
    exit 0
  fi

  if ((attempt < wait_attempts)); then
    sleep "$wait_seconds"
  fi
done

printf 'Serving topology verification failed for %s: template(image=%s min=%s max=%s volumes=%s mounts=%s provisioning=%s); revision(name=%s active=%s image=%s min=%s max=%s volumes=%s mounts=%s); active_revisions=%s running_replicas=%s.\n' \
  "$app_name" "$actual_image" "$actual_min" "$actual_max" "$template_volumes" "$template_mounts" "$provisioning_state" \
  "$latest_revision" "$revision_active" "$revision_image" "$revision_min" "$revision_max" "$revision_volumes" "$revision_mounts" \
  "$active_revisions" "$running_replicas" >&2
exit 1
