#!/bin/sh
# Launches the patched Firefox build with a dedicated profile, pointed at the dev server.
set -e

dir="$(cd "$(dirname "$0")" && pwd)"
firefox_src="${FIREFOX_SRC:-$HOME/src/firefox}"
url="${1:-http://localhost:5173/}"

mkdir -p "$dir/profile"
cp "$dir/user.js" "$dir/profile/user.js"

cd "$firefox_src"
MOZCONFIG="$firefox_src/mozconfig-video" exec ./mach run --profile "$dir/profile" "$url"
