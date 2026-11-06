import { useMemo } from "react";
import { useFetch } from "./useFetch.js";
import { STARTER_SET, publishableAchievements, fromApi, isPublishable } from "./achievements.js";

// The achievements the public website may show. See achievements.js for the rules.
//  - Server has no records yet ("managed" is false): the starter set from the flyer is shown.
//  - Server has records: ONLY those it sends are shown (so hiding someone in the admin hides them everywhere).
//  - Server unreachable: nothing is shown (the safe choice, because consent may have been withdrawn).
export function useAchievers() {
  const { data, error, loading } = useFetch("/public/achievements");
  const list = useMemo(() => {
    if (!data) return [];
    if (data.managed) return (data.achievers || []).map(fromApi).filter(isPublishable);
    return publishableAchievements(STARTER_SET);
  }, [data]);
  return { list, loading, error };
}
