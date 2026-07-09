#!/bin/bash
# =============================================================================
# Wazuh Setup Script — Phase 1
# =============================================================================
# This script:
#   1. Creates the shared Docker network (soc-network)
#   2. Generates SSL certificates for Wazuh
#   3. Starts the Wazuh stack
#   4. Waits for Wazuh Manager to be ready
#   5. Installs the custom SOC platform integration
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- Step 1: Generate SSL certificates ----
# Note: the shared 'soc-network' is created by the main stack in Step 3 below
# (it owns the network); the Wazuh stack attaches to it as `external`.
if [ ! -f "$SCRIPT_DIR/config/wazuh_indexer_ssl_certs/root-ca.pem" ]; then
    info "Generating SSL certificates..."
    bash "$SCRIPT_DIR/generate-certs.sh"
else
    info "SSL certificates already exist, skipping generation"
fi

# ---- Step 3: Start the main platform stack (if not running) ----
info "Starting main platform stack..."
cd "$PROJECT_ROOT"
docker compose up -d --build 2>&1 | tail -5
cd "$SCRIPT_DIR"

# ---- Step 4: Start Wazuh stack ----
info "Starting Wazuh stack (this may take 2-3 minutes on first run)..."
docker compose -f docker-compose.wazuh.yml up -d 2>&1 | tail -5

# ---- Step 5: Wait for Wazuh Manager to be ready ----
info "Waiting for Wazuh Manager to initialize..."
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec wazuh-manager /var/ossec/bin/wazuh-control status 2>/dev/null | grep -q "running"; then
        info "Wazuh Manager is running!"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo -n "."
done
echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
    warn "Wazuh Manager did not start within ${MAX_WAIT}s — check logs with: docker logs wazuh-manager"
fi

# ---- Step 6: Install custom integration ----
info "Installing custom SOC platform integration..."

# Copy integration script into the Wazuh Manager container
docker cp "$SCRIPT_DIR/custom-soc-platform.py" wazuh-manager:/var/ossec/integrations/custom-soc-platform.py
docker exec wazuh-manager chmod 750 /var/ossec/integrations/custom-soc-platform.py
docker exec wazuh-manager chown root:wazuh /var/ossec/integrations/custom-soc-platform.py

# Also create the shell wrapper Wazuh expects (it looks for 'custom-soc-platform' without .py)
docker exec wazuh-manager bash -c 'cat > /var/ossec/integrations/custom-soc-platform << "WRAPPER"
#!/bin/sh
/var/ossec/framework/python/bin/python3 /var/ossec/integrations/custom-soc-platform.py "$@"
WRAPPER'
docker exec wazuh-manager chmod 750 /var/ossec/integrations/custom-soc-platform
docker exec wazuh-manager chown root:wazuh /var/ossec/integrations/custom-soc-platform

info "Integration script installed"

# ---- Step 7: Add integration config to ossec.conf ----
info "Configuring Wazuh to forward alerts to SOC platform..."

# Check if integration already configured
if docker exec wazuh-manager grep -q "custom-soc-platform" /var/ossec/etc/ossec.conf 2>/dev/null; then
    warn "Integration already configured in ossec.conf"
else
    # Insert the integration block before the closing </ossec_config> tag
    docker exec wazuh-manager bash -c 'sed -i "/<\/ossec_config>/i\\
  <!-- SOC Platform Custom Integration -->\\
  <integration>\\
    <name>custom-soc-platform</name>\\
    <hook_url>http://soc-ingestion:8000/api/v1/alerts/wazuh</hook_url>\\
    <api_key>soc-ingest-token-dev</api_key>\\
    <level>3</level>\\
    <alert_format>json</alert_format>\\
  </integration>" /var/ossec/etc/ossec.conf'
    info "Integration block added to ossec.conf"
fi

# ---- Step 8: Restart Wazuh Manager to pick up changes ----
info "Restarting Wazuh Manager to apply integration config..."
docker exec wazuh-manager /var/ossec/bin/wazuh-control restart 2>&1 | tail -3

echo ""
info "============================================"
info "Wazuh setup complete!"
info "============================================"
echo ""
echo "  Dashboard:  https://localhost:443"
echo "  Username:   admin"
echo "  Password:   SecretPassword"
echo ""
echo "  Agent enrollment port: 1515"
echo "  Agent connection port: 1514"
echo ""
echo "  To add your VM as an agent, go to the Dashboard → Agents → Deploy new agent"
echo "  Use the Wazuh Manager IP (your laptop IP) as the server address."
echo ""
echo "  Alerts with level >= 3 will be forwarded to:"
echo "  http://soc-ingestion:8000/api/v1/alerts/wazuh"
echo ""
