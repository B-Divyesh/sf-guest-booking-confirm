#!/usr/bin/env bash
set -euo pipefail

# This is the product's release entry point. The factory deployer defaults to
# maxReplicas=3, which is unsafe for this product's replica-local SQLite store
# and rate-limit ledger. Always converge and verify the topology before the
# release command succeeds.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
product_slug="${PRODUCT_SLUG:-guest-booking-confirm}"
dockerfile="${DOCKERFILE:-Dockerfile}"
container_port="${CONTAINER_PORT:-8080}"
factory_deploy_script="${FACTORY_DEPLOY_SCRIPT:-/opt/fleet/lib/deploy-container.sh}"
resource_group="${AZURE_RESOURCE_GROUP:-sociobot}"
app_name="${AZURE_CONTAINER_APP:-sf-guest-booking-confirm}"
public_url="${PUBLIC_URL:-https://guest-booking-confirm.sociobot.in}"
release_verify_script="${RELEASE_VERIFY_SCRIPT:-$repo_dir/scripts/verify-release.mjs}"
source_sha="$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || true)"

if [[ ! -x "$factory_deploy_script" ]]; then
  printf 'Factory deploy script is not executable: %s\n' "$factory_deploy_script" >&2
  exit 2
fi

if [[ -z "$source_sha" ]]; then
  printf 'Cannot determine the source commit for release verification.\n' >&2
  exit 2
fi

if [[ ! -x "$release_verify_script" ]]; then
  printf 'Release verification script is not executable: %s\n' "$release_verify_script" >&2
  exit 2
fi

"$factory_deploy_script" "$product_slug" "$repo_dir" "$dockerfile" "$container_port"
"$repo_dir/deploy/ensure-persistent-data.sh" "$resource_group" "$app_name"
"$repo_dir/deploy/enforce-single-replica.sh" "$resource_group" "$app_name"
"$release_verify_script" "$public_url" "$source_sha"
# Make the topology correction the final infrastructure operation as well. This
# closes the release only after the live traffic test and protects against a
# concurrent deployment changing the scale template while verification runs.
"$repo_dir/deploy/enforce-single-replica.sh" "$resource_group" "$app_name"
