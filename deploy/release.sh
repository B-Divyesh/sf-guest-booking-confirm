#!/usr/bin/env bash
set -euo pipefail

# This product does not provision its own storage or Container App template.
# The fleet deployer owns the Azure Files share and template lifecycle. For a
# SQLite desk it receives WO_DATA_DIR=/data, which makes the fleet mount the
# managed share and use one replica before it publishes the revision.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dockerfile="${DOCKERFILE:-Dockerfile}"
public_url="${PUBLIC_URL:-https://guest-booking-confirm.sociobot.in}"
release_verify_script="${RELEASE_VERIFY_SCRIPT:-$repo_dir/scripts/verify-release.mjs}"
topology_verify_script="${TOPOLOGY_VERIFY_SCRIPT:-$repo_dir/deploy/verify-live-topology.sh}"
fleet_deployer="${FLEET_DEPLOY_CONTAINER:-/opt/fleet/lib/deploy-container.sh}"
source_sha="$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || true)"
image_tag="${source_sha:0:12}"
image="sociobotregistry.azurecr.io/sf-guest-booking-confirm:$image_tag"

if [[ -z "$source_sha" ]]; then
  printf 'Cannot determine the source commit for release verification.\n' >&2
  exit 2
fi

if [[ ! -x "$release_verify_script" ]]; then
  printf 'Release verification script is not executable: %s\n' "$release_verify_script" >&2
  exit 2
fi

if [[ ! -x "$topology_verify_script" ]]; then
  printf 'Topology verification script is not executable: %s\n' "$topology_verify_script" >&2
  exit 2
fi

if [[ ! -x "$fleet_deployer" ]]; then
  printf 'Fleet container deployer is not executable: %s\n' "$fleet_deployer" >&2
  exit 2
fi

if [[ ! -f "$repo_dir/$dockerfile" ]]; then
  printf 'Dockerfile not found: %s\n' "$repo_dir/$dockerfile" >&2
  exit 2
fi

if [[ "${WO_DATA_DIR:-}" != "/data" ]]; then
  printf 'Guest Booking Confirm requires the fleet work order to set deploy.data_dir to /data; got <%s>.\n' "${WO_DATA_DIR:-}" >&2
  exit 2
fi

"$fleet_deployer" "guest-booking-confirm" "$repo_dir" "$dockerfile" "8080"
"$topology_verify_script" "sociobot" "sf-guest-booking-confirm" "$image"
"$release_verify_script" "$public_url" "$source_sha"
"$topology_verify_script" "sociobot" "sf-guest-booking-confirm" "$image"
