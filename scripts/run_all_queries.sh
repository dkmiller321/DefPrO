#!/bin/bash
# Execute all SPARQL queries against Fuseki and output results
FUSEKI_URL="${1:-http://localhost:3030}"
DATASET="procurement"

echo "=== Running All SPARQL Queries ==="
echo ""

for qfile in ../triplestore/queries/*.sparql; do
  BASENAME=$(basename "$qfile" .sparql)
  echo "--- $BASENAME ---"
  QUERY=$(cat "$qfile" | grep -v "^#")
  curl -s \
    -H "Accept: text/csv" \
    --data-urlencode "query=$QUERY" \
    "$FUSEKI_URL/$DATASET/sparql" | head -20
  echo ""
  echo ""
done

echo "=== Done ==="
