import { error, json, readJson, withAuth } from "@/lib/http";
import {
  createBoundary,
  listBoundaries,
  type BoundaryInput,
} from "@/lib/repositories/boundaries";

export const GET = withAuth(async ({ db, userId }) => {
  return json({ boundaries: await listBoundaries(db, userId) });
});

export const POST = withAuth(async ({ db, userId }, request) => {
  const body = await readJson<Partial<BoundaryInput>>(request);
  if (!body.name?.trim()) return error("name 은 필수입니다.");
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return error("latitude·longitude 는 숫자여야 합니다.");
  }
  if (typeof body.radiusM !== "number" || body.radiusM <= 0) {
    return error("radiusM 은 양수여야 합니다.");
  }
  const boundary = await createBoundary(db, userId, {
    name: body.name.trim(),
    address: body.address ?? null,
    latitude: body.latitude,
    longitude: body.longitude,
    radiusM: body.radiusM,
    color: body.color,
    icon: body.icon,
    description: body.description ?? null,
    isDefault: body.isDefault ?? false,
  });
  return json({ boundary }, { status: 201 });
});
