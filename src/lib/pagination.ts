export function parsePageLimit(
  query: Record<string, unknown>,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
) {
  const page = Math.max(1, Number(query.page) || defaults.page || 1);
  const maxLimit = defaults.maxLimit ?? 50;
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number(query.limit) || defaults.limit || 20),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function pageMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}
