import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  label: string;
  value: number;
  group: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  value: number;
}

interface NetworkProps {
  nodes: Node[];
  links: Link[];
  loading?: boolean;
}

const GROUP_COLORS: Record<string, string> = {
  Agency: "#f59e0b",
  "AI and Machine Learning": "#8b5cf6",
  "Cyber Security": "#ef4444",
  "Electronic Warfare": "#06b6d4",
  "Autonomous Systems": "#22c55e",
  "C4ISR": "#3b82f6",
  "Space Systems": "#a855f7",
  "Missile Defense": "#f97316",
  Other: "#6b7280",
};

export default function ContractorNetwork({ nodes, links, loading }: NetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 500;

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 5])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const maxVal = Math.max(...nodes.map((n) => n.value), 1);
    const sizeScale = d3.scaleSqrt().domain([0, maxVal]).range([4, 24]);

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
          .id((d: any) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => sizeScale(d.value) + 4));

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#374151")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d) => Math.max(1, Math.sqrt(d.value / 1e6)));

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => sizeScale(d.value))
      .attr("fill", (d) => GROUP_COLORS[d.group] || GROUP_COLORS.Other)
      .attr("stroke", "#1a2235")
      .attr("stroke-width", 1.5)
      .attr("cursor", "grab")
      .call(
        d3
          .drag<SVGCircleElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label.length > 20 ? d.label.slice(0, 20) + "..." : d.label)
      .attr("font-size", 9)
      .attr("fill", "#9ca3af")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => sizeScale(d.value) + 12);

    // Tooltip
    node.append("title").text((d) => `${d.label}\n$${(d.value / 1e6).toFixed(1)}M`);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  if (loading) {
    return <div className="skeleton h-[500px] w-full rounded-xl" />;
  }

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Contractor Network
      </h3>
      {nodes.length === 0 ? (
        <p className="text-gray-500 text-sm h-[500px] flex items-center justify-center">
          No network data available. Load data into Fuseki first.
        </p>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height={500}
          className="bg-navy-800/50 rounded-lg"
        />
      )}
    </div>
  );
}
