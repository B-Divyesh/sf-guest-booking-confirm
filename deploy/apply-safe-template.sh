#!/usr/bin/env bash
set -euo pipefail

# Apply the next image together with the only safe topology for this SQLite
# desk.  The factory's generic container deployer publishes a max=3,
# no-volume template first; that briefly exposes split state.  This script
# patches the image, Azure Files mount, and one-replica scale as one revision
# template before the image can receive traffic.
resource_group="${1:-sociobot}"
app_name="${2:-sf-guest-booking-confirm}"
image="${3:-}"
storage_name="${AZURE_ENV_STORAGE_NAME:-guest-booking-confirm-data}"
volume_name="gbc-data"
mount_path="/data"
verify_only="${SAFE_TEMPLATE_VERIFY_ONLY:-0}"
wait_attempts="${SAFE_TEMPLATE_WAIT_ATTEMPTS:-60}"
wait_seconds="${SAFE_TEMPLATE_WAIT_SECONDS:-2}"

command -v jq >/dev/null || {
  printf 'jq is required to apply the safe Container App template.\n' >&2
  exit 2
}
if [[ "$verify_only" != "1" && -z "$image" ]]; then
  printf 'Usage: %s <resource-group> <app-name> <image>\n' "$0" >&2
  exit 2
fi
if [[ ! "$wait_attempts" =~ ^[1-9][0-9]*$ || ! "$wait_seconds" =~ ^[0-9]+$ ]]; then
  printf 'Safe-template wait settings must be non-negative integers, with at least one attempt.\n' >&2
  exit 2
fi

app_json="$(az containerapp show \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --output json)"
resource_id="$(jq -r '.id' <<<"$app_json")"
if [[ -z "$resource_id" || "$resource_id" == "null" ]]; then
  printf 'Could not resolve the Container App resource ID.\n' >&2
  exit 1
fi

if [[ "$verify_only" != "1" ]]; then
  template_patch="$(jq -c \
    --arg image "$image" \
    --arg storage_name "$storage_name" \
    --arg volume_name "$volume_name" \
    --arg mount_path "$mount_path" \
    '.properties.template
    | .containers[0].image = $image
    | .containers[0].env = (((.containers[0].env // []) | map(select(.name != "PORT"))) + [{name:"PORT", value:"8080"}])
    | .containers[0].volumeMounts = (((.containers[0].volumeMounts // []) | map(select(.volumeName != $volume_name))) + [{volumeName:$volume_name, mountPath:$mount_path}])
    | .containers[0].resources = ((.containers[0].resources // {cpu:0.5, memory:"1Gi"}) | del(.ephemeralStorage))
    | .volumes = (((.volumes // []) | map(select(.name != $volume_name))) + [{name:$volume_name, storageType:"AzureFile", storageName:$storage_name}])
    | .scale = ((.scale // {}) | .minReplicas = 1 | .maxReplicas = 1 | del(.cooldownPeriod, .pollingInterval, .rules))
    | {properties:{template:.}}' <<<"$app_json")"
  az rest \
    --method patch \
    --url "https://management.azure.com${resource_id}?api-version=2024-03-01" \
    --body "$template_patch" \
    --output none
fi

actual_image=""
actual_min=""
actual_max=""
mounted_volumes="0"
mounted_paths="0"
provisioning_state=""
for ((attempt = 1; attempt <= wait_attempts; attempt += 1)); do
  deployed_app="$(az containerapp show \
    --resource-group "$resource_group" \
    --name "$app_name" \
    --output json)"
  actual_image="$(jq -r '.properties.template.containers[0].image // ""' <<<"$deployed_app")"
  actual_min="$(jq -r '.properties.template.scale.minReplicas // ""' <<<"$deployed_app")"
  actual_max="$(jq -r '.properties.template.scale.maxReplicas // ""' <<<"$deployed_app")"
  mounted_volumes="$(jq -r \
    --arg storage_name "$storage_name" \
    --arg volume_name "$volume_name" \
    '[.properties.template.volumes[]? | select(.name == $volume_name and .storageName == $storage_name and .storageType == "AzureFile")] | length' <<<"$deployed_app")"
  mounted_paths="$(jq -r \
    --arg volume_name "$volume_name" \
    --arg mount_path "$mount_path" \
    '[.properties.template.containers[0].volumeMounts[]? | select(.volumeName == $volume_name and .mountPath == $mount_path)] | length' <<<"$deployed_app")"
  provisioning_state="$(jq -r '.properties.provisioningState // "Succeeded"' <<<"$deployed_app")"

  image_matches=1
  if [[ "$verify_only" != "1" && "$actual_image" != "$image" ]]; then
    image_matches=0
  fi
  if [[ "$image_matches" == "1" && "$actual_min" == "1" && "$actual_max" == "1" && "$mounted_volumes" == "1" && "$mounted_paths" == "1" && "$provisioning_state" == "Succeeded" ]]; then
    printf 'Verified safe template for %s: image=%s, Azure Files /data, min=1, max=1.\n' \
      "$app_name" "$actual_image"
    exit 0
  fi
  if ((attempt < wait_attempts)); then
    sleep "$wait_seconds"
  fi
done

printf 'Safe template verification failed for %s: image=%s min=%s max=%s volumes=%s mounts=%s provisioning=%s.\n' \
  "$app_name" "$actual_image" "$actual_min" "$actual_max" "$mounted_volumes" "$mounted_paths" "$provisioning_state" >&2
exit 1
