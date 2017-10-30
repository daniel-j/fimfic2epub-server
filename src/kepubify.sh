#!/usr/bin/env bash

set -e

EPUBFILE="$(readlink -f "$1")"
KEPUBFILE="$(readlink -f "$2")"
WORKINGDIR="$3"
TOOLDIR="$(readlink -f "${0%/*}")"

mkdir -p "$WORKINGDIR"
WORKINGDIR="$(readlink -f "$WORKINGDIR")"
rm -rf "$WORKINGDIR/src"
mkdir -p "$WORKINGDIR/src"
cp -f "$EPUBFILE" "$KEPUBFILE"
unzip "$EPUBFILE" -d "$WORKINGDIR/src"
cd "$WORKINGDIR"

XHTMLFILES="$(find src -name '*.xhtml' | sort)"

for current in $XHTMLFILES; do
	echo "Kepubifying $current..."
	mkdir -p "$(dirname "tmp/$current")"
	"$TOOLDIR/kepubify.py" "$current" > "tmp/$current"
done

rm -rf src
cd "tmp/src"
zip -Xr9D "$KEPUBFILE" .
cd ../..
rm -rf tmp
# remove dir if empty
rmdir "$WORKINGDIR" || true
