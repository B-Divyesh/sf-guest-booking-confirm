#!/usr/bin/env bash
set -euo pipefail

# The standard factory deployment replaces the container template and removes
# product-specific volumes. Reattach one private Azure Files share so SQLite
# survives revision replacement. The account key is read only long enough to
# register the environment storage and is never printed or stored in the app.
resource_group="${1:-sociobot}"
app_name="${2:-sf-guest-booking-confirm}"
environment_name="${AZURE_CONTAINER_ENV:-factory-env}"
storage_account="${AZURE_STORAGE_ACCOUNT:-sociobotblob}"
storage_name="${AZURE_ENV_STORAGE_NAME:-guest-booking-confirm-data}"
share_name="${AZURE_FILE_SHARE_NAME:-sf-guest-booking-confirm-data}"
volume_name="gbc-data"
mount_path="/data"

command -v jq >/dev/null || {
  printf 'jq is required to preserve the deployed container template.\n' >&2
  exit 2
}

if ! az storage share-rm show \
  --resource-group "$resource_group" \
  --storage-account "$storage_account" \
  --name "$share_name" \
  --output none 2>/dev/null; then
  az storage share-rm create \
    --resource-group "$resource_group" \
    --storage-account "$storage_account" \
    --name "$share_name" \
    --quota 5 \
    --output none
fi

if ! az containerapp env storage show \
  --resource-group "$resource_group" \
  --name "$environment_name" \
  --storage-name "$storage_name" \
  --output none 2>/dev/null; then
  storage_key="$(az storage account keys list \
    --resource-group "$resource_group" \
    --account-name "$storage_account" \
    --query '[0].value' \
    --output tsv)"
  if [[ -z "$storage_key" ]]; then
    printf 'Could not obtain the Azure Files key for persistent data.\n' >&2
    exit 1
  fi
  az containerapp env storage set \
    --resource-group "$resource_group" \
    --name "$environment_name" \
    --storage-name "$storage_name" \
    --access-mode ReadWrite \
    --azure-file-account-name "$storage_account" \
    --azure-file-account-key "$storage_key" \
    --azure-file-share-name "$share_name" \
    --output none
  unset storage_key
fi

app_json="$(az containerapp show \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --output json)"
resource_id="$(jq -r '.id' <<<"$app_json")"
template_patch="$(jq -c \
  --arg storage_name "$storage_name" \
  --arg volume_name "$volume_name" \
  --arg mount_path "$mount_path" \
  '.properties.template.volumes = (((.properties.template.volumes // []) | map(select(.name != $volume_name))) + [{name:$volume_name, storageType:"AzureFile", storageName:$storage_name}])
  | .properties.template.containers[0].volumeMounts = (((.properties.template.containers[0].volumeMounts // []) | map(select(.volumeName != $volume_name))) + [{volumeName:$volume_name, mountPath:$mount_path}])
  | {properties:{template:.properties.template}}' <<<"$app_json")"

if [[ -z "$resource_id" || "$resource_id" == "null" ]]; then
  printf 'Could not resolve the container app resource ID.\n' >&2
  exit 1
fi

az rest \
  --method patch \
  --url "https://management.azure.com${resource_id}?api-version=2024-03-01" \
  --body "$template_patch" \
  --output none

mounted_volumes="$(az containerapp show \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --query "properties.template.volumes[?name == '$volume_name' && storageName == '$storage_name' && storageType == 'AzureFile'] | length(@)" \
  --output tsv)"
mounted_paths="$(az containerapp show \
  --resource-group "$resource_group" \
  --name "$app_name" \
  --query "properties.template.containers[0].volumeMounts[?volumeName == '$volume_name' && mountPath == '$mount_path'] | length(@)" \
  --output tsv)"

if [[ "$mounted_volumes" != "1" || "$mounted_paths" != "1" ]]; then
  printf 'Persistent data mount verification failed for %s: volumes=%s mounts=%s.\n' \
    "$app_name" "$mounted_volumes" "$mounted_paths" >&2
  exit 1
fi

printf 'Verified %s mounts persistent Azure Files storage at %s.\n' "$app_name" "$mount_path"
