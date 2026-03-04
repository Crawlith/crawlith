import { PageRankTable } from './Graphs/PageRankTable';
import { SimpleBarChart } from './Graphs/SimpleBarChart';
import { DuplicateClusterChart } from './Graphs/DuplicateClusterChart';
import { LinkDistributionChart } from './Graphs/LinkDistributionChart';

export const GraphIntelligenceSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <div className="h-80">
        <PageRankTable />
      </div>
      <div className="h-80">
        <SimpleBarChart />
      </div>
      <div className="h-80">
        <DuplicateClusterChart />
      </div>
      <div className="h-80">
        <LinkDistributionChart />
      </div>
    </div>
  );
};
