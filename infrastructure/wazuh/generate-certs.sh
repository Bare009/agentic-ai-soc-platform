#!/bin/bash
# =============================================================================
# Generate SSL certificates for Wazuh single-node Docker deployment
# =============================================================================
set -e

CERTS_DIR="$(dirname "$0")/config/wazuh_indexer_ssl_certs"
mkdir -p "$CERTS_DIR"

echo "==> Generating Root CA..."
openssl req -x509 -new -nodes -newkey rsa:2048 \
  -keyout "$CERTS_DIR/root-ca-key.pem" \
  -out "$CERTS_DIR/root-ca.pem" \
  -days 3650 -batch \
  -subj "/C=US/ST=CA/L=SanJose/O=Wazuh/CN=Wazuh Root CA" 2>/dev/null

generate_cert() {
  local name=$1 cn=$2 san=$3
  echo "==> Generating cert for $name..."
  openssl req -new -nodes -newkey rsa:2048 \
    -keyout "$CERTS_DIR/${name}-key.pem" \
    -out "$CERTS_DIR/${name}.csr" \
    -subj "/C=US/ST=CA/L=SanJose/O=Wazuh/CN=${cn}" 2>/dev/null

  if [ -n "$san" ]; then
    openssl x509 -req -in "$CERTS_DIR/${name}.csr" \
      -CA "$CERTS_DIR/root-ca.pem" -CAkey "$CERTS_DIR/root-ca-key.pem" \
      -CAcreateserial -out "$CERTS_DIR/${name}.pem" -days 3650 \
      -extfile <(echo "subjectAltName=${san}") 2>/dev/null
  else
    openssl x509 -req -in "$CERTS_DIR/${name}.csr" \
      -CA "$CERTS_DIR/root-ca.pem" -CAkey "$CERTS_DIR/root-ca-key.pem" \
      -CAcreateserial -out "$CERTS_DIR/${name}.pem" -days 3650 2>/dev/null
  fi
  rm -f "$CERTS_DIR/${name}.csr"
}

generate_cert "admin" "admin" ""
generate_cert "wazuh.indexer" "wazuh.indexer" "DNS:wazuh.indexer,DNS:localhost,IP:127.0.0.1"
generate_cert "wazuh.manager" "wazuh.manager" "DNS:wazuh.manager"
generate_cert "wazuh.dashboard" "wazuh.dashboard" "DNS:wazuh.dashboard,DNS:localhost,IP:127.0.0.1"

# Copy root-ca for manager (Filebeat needs it as root-ca-manager.pem)
cp "$CERTS_DIR/root-ca.pem" "$CERTS_DIR/root-ca-manager.pem"

chmod 400 "$CERTS_DIR"/*-key.pem
chmod 444 "$CERTS_DIR"/*.pem

echo "==> Certificates generated in $CERTS_DIR"
ls -la "$CERTS_DIR"
