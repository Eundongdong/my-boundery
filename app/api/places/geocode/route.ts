import { error, json, withAuth } from "@/lib/http";
import { searchAddress } from "@/lib/kakao";

// GET /api/places/geocode?address=... → { result: {address,latitude,longitude} | null }
export const GET = withAuth(async (_ctx, request) => {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) return error("address 쿼리가 필요합니다.");
  const result = await searchAddress(address);
  return json({ result });
});
