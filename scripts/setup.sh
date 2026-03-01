#!/bin/bash
# Full environment setup for Defense Procurement Ontology Platform
set -e

echo "=== DefPrO Environment Setup ==="

# Python dependencies
echo "[1/5] Installing Python dependencies..."
pip install -r requirements.txt --quiet

# Generate sample data
echo "[2/5] Generating sample data..."
python scripts/seed_sample_data.py

# Start Fuseki
echo "[3/5] Starting Fuseki triple store..."
docker compose up -d fuseki
echo "Waiting for Fuseki to be ready..."
for i in {1..30}; do
  if curl -sf http://localhost:3030/$/ping > /dev/null 2>&1; then
    echo "Fuseki is ready."
    break
  fi
  sleep 2
done

# Load data into Fuseki
echo "[4/5] Loading data into Fuseki..."
cd triplestore && bash load_data.sh && cd ..

# Install dashboard dependencies
echo "[5/5] Installing dashboard dependencies..."
cd dashboard && npm install --quiet && cd ..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the dashboard:  cd dashboard && npm run dev"
echo "To run ETL pipeline:     python -m etl.pipeline --agency 'Defense Advanced Research Projects Agency' --fiscal-year 2024 --dry-run"
echo "To run tests:            python -m pytest tests/ -v"
echo "Fuseki UI:               http://localhost:3030"
echo "Dashboard:               http://localhost:5173"
