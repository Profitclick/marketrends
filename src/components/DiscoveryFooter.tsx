import { MostReadToday } from "./MostReadToday";
import { TrendingTopics } from "./TrendingTopics";
import { TrendingEntities } from "./TrendingEntities";
import { RecommendedForYou } from "./RecommendedForYou";

interface Props {
  excludeId?: string;
}

// Standardized discovery footer for hub-style pages (knowledge, guide, etc.).
// Adds: personalised picks, most-read, trending topics, trending entities.
export const DiscoveryFooter = ({ excludeId }: Props) => (
  <section className="border-t-2 border-foreground mt-16 pt-10">
    <RecommendedForYou limit={4} excludeId={excludeId} />
    <div className="grid lg:grid-cols-3 gap-10 mt-8">
      <MostReadToday limit={6} title="Mest lest i dag" />
      <TrendingTopics variant="sidebar" limit={10} />
      <TrendingEntities limit={8} />
    </div>
  </section>
);
