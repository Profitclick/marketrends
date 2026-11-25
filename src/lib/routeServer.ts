import { createServerFn } from "@tanstack/react-start";
import {
  loadCategoryRouteData,
  loadClusterRouteData,
  loadCompareRouteData,
  loadEntityRouteData,
  loadGuideRouteData,
  loadKnowledgeRouteData,
  loadNewsRouteData,
  loadSearchIntentRouteData,
  loadTopicRouteData,
} from "@/lib/routeData";

const validateSlug = (data: { slug?: string }) => data;

async function serverClient() {
  const { createPublicServerClient } = await import("@/integrations/supabase/serverPublic");
  return createPublicServerClient();
}

export const getNewsRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadNewsRouteData(await serverClient(), data.slug));

export const getCategoryRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadCategoryRouteData(await serverClient(), data.slug));

export const getTopicRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadTopicRouteData(await serverClient(), data.slug));

export const getEntityRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadEntityRouteData(await serverClient(), data.slug));

export const getGuideRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadGuideRouteData(await serverClient(), data.slug));

export const getKnowledgeRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadKnowledgeRouteData(await serverClient(), data.slug));

export const getCompareRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadCompareRouteData(await serverClient(), data.slug));

export const getSearchIntentRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadSearchIntentRouteData(await serverClient(), data.slug));

export const getClusterRouteData = createServerFn({ method: "GET" })
  .validator(validateSlug)
  .handler(async ({ data }) => loadClusterRouteData(await serverClient(), data.slug));
