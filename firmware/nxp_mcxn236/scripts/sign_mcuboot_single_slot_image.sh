#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
    echo "usage: MCUBOOT_SIGN_KEY=/path/sign-ecdsa-p256-priv.pem IMGTOOL=/path/imgtool.py $0 <raw.bin> <version> <signed.bin>" >&2
    exit 2
fi

: "${MCUBOOT_SIGN_KEY:?set MCUBOOT_SIGN_KEY to the existing ECDSA-P256 private key}"
IMGTOOL="${IMGTOOL:-imgtool.py}"
INPUT="$1"
VERSION="$2"
OUTPUT="$3"

python3 "$IMGTOOL" sign \
    --key "$MCUBOOT_SIGN_KEY" \
    --header-size 0x400 \
    --align 16 \
    --slot-size 0x100000 \
    --max-sectors 128 \
    --version "$VERSION" \
    --pad-header \
    --pad \
    --confirm \
    "$INPUT" "$OUTPUT"
