export function renderSitegraphCsvNodes(graphData: any): string {
    const nodeHeaders = ['URL', 'Depth', 'Status', 'InboundLinks', 'OutboundLinks', 'PageRankScore'];
    const nodeRows = graphData.nodes.map((n: any) => {
        const outbound = graphData.edges.filter((e: any) => e.source === n.url).length;
        const inbound = graphData.edges.filter((e: any) => e.target === n.url).length;
        const statusStr = n.status === 0 ? 'Pending/Limit' : n.status;
        return [n.url, n.depth, statusStr, inbound, outbound, (n.pageRankScore || 0).toFixed(3)].join(',');
    });
    return [nodeHeaders.join(','), ...nodeRows].join('\n');
}

export function renderSitegraphCsvEdges(graphData: any): string {
    const edgeHeaders = ['Source', 'Target', 'Weight'];
    const edgeRows = graphData.edges.map((e: any) => [e.source, e.target, e.weight].join(','));
    return [edgeHeaders.join(','), ...edgeRows].join('\n');
}

export function renderSitegraphMarkdown(url: string, graphData: any, metrics: any, graph: any): string {
    const md = [
        `# Crawlith Crawl Summary - ${url}`,
        '',
        `## 📊 Metrics`,
        `- Total Pages Discovered: ${metrics.totalPages}`,
        `- Session Pages Crawled: ${graph.sessionStats?.pagesFetched ?? 0}`,
        `- Total Edges: ${metrics.totalEdges}`,
        `- Avg Depth: ${metrics.averageDepth.toFixed(2)}`,
        `- Max Depth: ${metrics.maxDepthFound}`,
        `- Crawl Efficiency: ${(metrics.crawlEfficiencyScore * 100).toFixed(1)}%`,
        '',
        `## 📄 Top Pages (by In-degree)`,
    ];

    const topPages = [...graphData.nodes]
        .map((n: any) => ({ ...n, inLinks: graphData.edges.filter((e: any) => e.target === n.url).length }))
        .sort((a, b) => b.inLinks - a.inLinks)
        .slice(0, 10);

    md.push('| URL | Inbound | Status |');
    md.push('| :--- | :--- | :--- |');
    topPages.forEach(p => {
        const statusStr = p.status === 0 ? 'Pending/Limit' : p.status;
        md.push(`| ${p.url} | ${p.inLinks} | ${statusStr} |`);
    });

    if (metrics.topPageRankPages?.length > 0) {
        md.push('');
        md.push('## 🏆 Top PageRank Pages');
        md.push('| URL | Score |');
        md.push('| :--- | :--- |');
        metrics.topPageRankPages.slice(0, 10).forEach((p: any) => {
            const node = graph.nodes?.get ? graph.nodes.get(p.url) : graph.getNodes?.().find((x: any) => x.url === p.url);
            const score = node?.pageRankScore ?? 0;
            md.push(`| ${p.url} | ${score.toFixed(3)}/100 |`);
        });
    }

    return md.join('\n');
}
