import { MostReadToday } from "./MostReadToday";

export const MostReadThisWeek = ({ limit = 5 }: { limit?: number }) => (
  <MostReadToday
    limit={limit}
    windowHours={24 * 7}
    title="Mest lest denne uken"
    icon="flame"
  />
);
