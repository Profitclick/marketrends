CREATE OR REPLACE FUNCTION public.find_entity_by_normalized_name(_name text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id, e.name FROM public.entities e
  WHERE public.normalize_node_name(e.name) = public.normalize_node_name(_name)
     OR EXISTS (SELECT 1 FROM unnest(e.aliases) al
                WHERE public.normalize_node_name(al) = public.normalize_node_name(_name))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_entity_by_normalized_name(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_entity_by_normalized_name(text) TO service_role;

CREATE OR REPLACE FUNCTION public.find_topic_by_normalized_name(_name text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, t.name FROM public.topics t
  WHERE public.normalize_node_name(t.name) = public.normalize_node_name(_name)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_topic_by_normalized_name(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_topic_by_normalized_name(text) TO service_role;