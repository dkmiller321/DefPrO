#!/bin/bash
# Load ontology and data into Fuseki
# Usage: ./load_data.sh [fuseki_url] [admin_password]

FUSEKI_URL="${1:-http://localhost:3030}"
ADMIN_PASSWORD="${2:-admin}"
DATASET="procurement"

echo "=== Loading Defense Procurement Ontology Data ==="
echo "Fuseki: $FUSEKI_URL"
echo ""

# Load the domain ontology into the default graph
echo "[1/3] Loading domain ontology..."
curl -s -u "admin:$ADMIN_PASSWORD" \
  -X PUT \
  -H "Content-Type: text/turtle" \
  --data-binary @../ontology/defense-procurement.ttl \
  "$FUSEKI_URL/$DATASET/data?default" \
  && echo " OK" || echo " FAILED"

# Load capability taxonomy
echo "[2/3] Loading capability taxonomy..."
curl -s -u "admin:$ADMIN_PASSWORD" \
  -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @../ontology/capability-taxonomy.ttl \
  "$FUSEKI_URL/$DATASET/data?default" \
  && echo " OK" || echo " FAILED"

# Load NAICS/PSC mapping
echo "[3/3] Loading NAICS/PSC mapping..."
curl -s -u "admin:$ADMIN_PASSWORD" \
  -X POST \
  -H "Content-Type: text/turtle" \
  --data-binary @../ontology/naics-psc-mapping.ttl \
  "$FUSEKI_URL/$DATASET/data?default" \
  && echo " OK" || echo " FAILED"

# Load any data files in output/
if [ -d "../output" ]; then
  for f in ../output/*.ttl; do
    if [ -f "$f" ]; then
      BASENAME=$(basename "$f" .ttl)
      GRAPH="http://defenseprocurement.io/data/$BASENAME"
      echo "Loading data: $BASENAME -> <$GRAPH>"
      curl -s -u "admin:$ADMIN_PASSWORD" \
        -X PUT \
        -H "Content-Type: text/turtle" \
        --data-binary @"$f" \
        "$FUSEKI_URL/$DATASET/data?graph=$GRAPH" \
        && echo " OK" || echo " FAILED"
    fi
  done
fi

# Verify
echo ""
echo "=== Verification ==="
COUNT=$(curl -s -u "admin:$ADMIN_PASSWORD" \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode "query=SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }" \
  "$FUSEKI_URL/$DATASET/sparql" | python3 -c "import sys,json; print(json.load(sys.stdin)['results']['bindings'][0]['count']['value'])" 2>/dev/null)

echo "Total triples loaded: $COUNT"
echo "=== Done ==="
