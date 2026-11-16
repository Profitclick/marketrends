export const getDisplayedTopicArticleCount = (
  materializedCount: number | null | undefined,
  loadedPublishedCount: number,
) => {
  const safeMaterializedCount =
    typeof materializedCount === "number" && Number.isFinite(materializedCount)
      ? Math.max(0, materializedCount)
      : 0;

  if (safeMaterializedCount === 0 && loadedPublishedCount > 0) {
    return loadedPublishedCount;
  }

  return safeMaterializedCount;
};
