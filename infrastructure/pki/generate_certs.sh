#!/usr/bin/env bash
# =============================================================================
# Phase 7 — PKI generation for the AI_SOC TLS/mTLS edge gateway.
#
# Produces, in this directory (infrastructure/pki/):
#   ca.crt / ca.key          - self-signed root CA (verifies everything below)
#   server.crt / server.key  - gateway TLS server cert (SAN: localhost, 127.0.0.1)
#   analyst.crt / analyst.key - analyst client cert (for mTLS on admin actions)
#   analyst.p12              - client bundle for browser import (pass: analyst)
#
# Usage:
#   bash infrastructure/pki/generate_certs.sh          # generate if missing
#   bash infrastructure/pki/generate_certs.sh --force  # regenerate everything
#
# NOTE: every file except this script is git-ignored — private keys never get
# committed. Re-run on any machine that needs to serve or call the gateway.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

FORCE="${1:-}"
DAYS_CA=3650
DAYS_LEAF=825
P12_PASS="analyst"

if [[ "$FORCE" == "--force" ]]; then
  rm -f ca.* server.* analyst.* ./*.srl ./*.csr ./*.ext
fi

if [[ -f ca.crt && -f server.crt && -f analyst.crt && "$FORCE" != "--force" ]]; then
  echo "Certificates already exist. Use --force to regenerate."
  exit 0
fi

echo "==> Root CA"
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" \
  -out ca.crt -subj "/C=US/O=AI_SOC/CN=AI_SOC Root CA"

echo "==> Gateway server certificate (SAN: localhost, 127.0.0.1)"
cat > server.ext <<'EOF'
subjectAltName = DNS:localhost, DNS:gateway, IP:127.0.0.1
extendedKeyUsage = serverAuth
keyUsage = digitalSignature, keyEncipherment
EOF
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
  -subj "/C=US/O=AI_SOC/CN=localhost"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS_LEAF" -sha256 -extfile server.ext

echo "==> Analyst client certificate (mTLS)"
cat > analyst.ext <<'EOF'
extendedKeyUsage = clientAuth
keyUsage = digitalSignature
EOF
openssl genrsa -out analyst.key 2048
openssl req -new -key analyst.key -out analyst.csr \
  -subj "/C=US/O=AI_SOC/OU=Analysts/CN=analyst"
openssl x509 -req -in analyst.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out analyst.crt -days "$DAYS_LEAF" -sha256 -extfile analyst.ext

echo "==> Analyst PKCS#12 bundle for browser import (password: ${P12_PASS})"
openssl pkcs12 -export -inkey analyst.key -in analyst.crt -certfile ca.crt \
  -out analyst.p12 -passout "pass:${P12_PASS}"

# Tidy intermediate artifacts.
rm -f server.csr analyst.csr server.ext analyst.ext

echo
echo "PKI ready in $(pwd):"
ls -1 ca.crt server.crt server.key analyst.crt analyst.key analyst.p12
echo
echo "Verify chain:"
openssl verify -CAfile ca.crt server.crt
openssl verify -CAfile ca.crt analyst.crt
