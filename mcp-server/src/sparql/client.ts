import type { SparqlResults } from "../types.js";

const DEFAULT_ENDPOINT = process.env.FUSEKI_ENDPOINT || "http://localhost:3030/procurement";
const TIMEOUT_MS = 30000;

export class SparqlClient {
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || DEFAULT_ENDPOINT;
  }

  async query(sparql: string): Promise<SparqlResults> {
    const url = `${this.endpoint}/sparql`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
        },
        body: `query=${encodeURIComponent(sparql)}`,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`SPARQL query failed (${resp.status}): ${body}`);
      }

      return (await resp.json()) as SparqlResults;
    } finally {
      clearTimeout(timer);
    }
  }

  async update(sparql: string): Promise<void> {
    const url = `${this.endpoint}/update`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `update=${encodeURIComponent(sparql)}`,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`SPARQL update failed (${resp.status}): ${body}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
