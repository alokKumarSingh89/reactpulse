import { findingRequest } from "@/lib/api/findings-bff";
export async function POST(request: Request, context: { params: Promise<{ findingId: string }> }) {
  return findingRequest(request, (await context.params).findingId, "ignore");
}
