# Wazuh Integration Setup — Phase 1

## Overview

This sets up Wazuh (SIEM) in Docker and configures it to forward alerts to our SOC platform's FastAPI ingestion endpoint.

```
Your VMs (Wazuh Agents) → Wazuh Manager → Custom Integration Script → FastAPI → Redis → Worker → MongoDB
```

## Prerequisites

- Docker & Docker Compose installed
- The main platform stack already working (Phase 0)

## Quick Start

### Step 1: Start the main stack first (it owns the shared network)

The main `docker-compose.yml` creates the shared `soc-network` (fixed name).
The Wazuh stack attaches to it as `external`, so the main stack must be up first.

```bash
cd /home/kernelops/Projects/agentic-ai-soc-platform
docker compose up --build -d
```

> **Note:** If you previously ran `docker network create soc-network` by hand,
> remove that unlabeled network once so Compose can manage it:
> `docker compose down && docker network rm soc-network` — then re-run the up.

### Step 3: Generate SSL certificates for Wazuh

```bash
cd infrastructure/wazuh
chmod +x generate-certs.sh setup.sh
bash generate-certs.sh
```

### Step 4: Start Wazuh

```bash
docker compose -f docker-compose.wazuh.yml up -d
```

Wait 2-3 minutes for Wazuh to fully initialize (it's heavy).

### Step 5: Install the custom integration

Once the Wazuh Manager is running:

```bash
# Copy the integration script into the Wazuh Manager container
docker cp custom-soc-platform.py wazuh-manager:/var/ossec/integrations/custom-soc-platform.py
docker exec wazuh-manager chmod 750 /var/ossec/integrations/custom-soc-platform.py
docker exec wazuh-manager chown root:wazuh /var/ossec/integrations/custom-soc-platform.py

# Create the shell wrapper
docker exec wazuh-manager bash -c 'cat > /var/ossec/integrations/custom-soc-platform << "EOF"
#!/bin/sh
/var/ossec/framework/python/bin/python3 /var/ossec/integrations/custom-soc-platform.py "$@"
EOF'
docker exec wazuh-manager chmod 750 /var/ossec/integrations/custom-soc-platform
docker exec wazuh-manager chown root:wazuh /var/ossec/integrations/custom-soc-platform

# Add integration config to ossec.conf
docker exec wazuh-manager bash -c 'sed -i "/<\/ossec_config>/i\\
  <integration>\\
    <name>custom-soc-platform</name>\\
    <hook_url>http://soc-ingestion:8000/api/v1/alerts/wazuh</hook_url>\\
    <api_key>soc-ingest-token-dev</api_key>\\
    <level>3</level>\\
    <alert_format>json</alert_format>\\
  </integration>" /var/ossec/etc/ossec.conf'

# Restart Wazuh Manager to pick up changes
docker exec wazuh-manager /var/ossec/bin/wazuh-control restart
```

Or simply run the setup script which does all of steps 1-5:

```bash
bash setup.sh
```

### Step 6: Add your VMs as Wazuh agents

1. Open the Wazuh Dashboard: **https://localhost:443**
   - Username: `admin`
   - Password: `SecretPassword`

2. Go to **Agents → Deploy new agent**

3. Follow the instructions to install the Wazuh agent on your VM:
   - Set the Wazuh Manager IP to your laptop's IP address
   - The agent will auto-enroll on port 1515

### Step 7: Test with a real attack

From your attacker VM, run against the monitored VM:

```bash
# SSH brute force with Hydra
hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://<victim-vm-ip>

# Or simply: rapid failed SSH logins
for i in $(seq 1 10); do sshpass -p "wrongpass" ssh -o StrictHostKeyChecking=no baduser@<victim-vm-ip> 2>/dev/null; done

# Port scan with Nmap
nmap -sV <victim-vm-ip>
```

### Step 8: Verify the pipeline

```bash
# Check Wazuh integration logs
docker exec wazuh-manager cat /var/ossec/logs/integrations.log

# Check our ingestion service logs
docker logs soc-ingestion --tail 20

# Check worker logs
docker logs soc-worker --tail 20

# Check MongoDB for new cases
docker exec soc-mongodb mongosh --quiet --eval "db = db.getSiblingDB('soc_platform'); db.cases.countDocuments()"

# Check metrics
curl -s http://localhost:8000/api/v1/metrics | python3 -m json.tool
```

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  Attacker VM │────>│  Victim VM   │
│  (Hydra/Nmap)│     │(Wazuh Agent) │
└──────────────┘     └──────┬───────┘
                            │ alerts
                     ┌──────▼───────┐
                     │Wazuh Manager │
                     │  (Docker)    │
                     └──────┬───────┘
                            │ custom-soc-platform integration
                     ┌──────▼───────┐
                     │  FastAPI     │──── DLQ (failed alerts)
                     │  Ingestion   │
                     └──────┬───────┘
                            │ Redis queue
                     ┌──────▼───────┐
                     │   Worker     │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   MongoDB    │
                     │   (cases)    │
                     └──────────────┘
```

## Troubleshooting

**Wazuh Manager won't start:** Check logs with `docker logs wazuh-manager`. Most common issue is SSL certificate problems — regenerate with `bash generate-certs.sh`.

**Integration not firing:** Verify the config is in ossec.conf:
```bash
docker exec wazuh-manager grep -A6 "custom-soc-platform" /var/ossec/etc/ossec.conf
```

**Alerts not reaching FastAPI:** Check the integration log:
```bash
docker exec wazuh-manager tail -20 /var/ossec/logs/integrations.log
```

**Network issues:** Verify both stacks are on the same network:
```bash
docker network inspect soc-network
```
