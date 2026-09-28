#!/bin/sh
# Pull, check, commit, push and deploy Lanemark in one go. Works from any folder: ./ship.sh --help
exec node "$(dirname "$0")/scripts/ship.mjs" "$@"
