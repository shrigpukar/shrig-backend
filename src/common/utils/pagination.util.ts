import { Model } from 'mongoose';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult {
  data: any;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function pagination(
  model: Model<any>,
  filter: any,
  options: PaginationOptions,
  transformFn: (data: any) => any,
  sort: any = { createdAt: -1 },
): Promise<PaginationResult> {
  console.log(filter, options, transformFn, sort);
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    model.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: data.map(transformFn),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
