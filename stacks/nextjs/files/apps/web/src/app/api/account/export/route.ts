import { dataExportResponse } from "@/lib/privacy/export";

// "Download your data": a JSON file of everything held about the signed-in person.
export async function GET(request: Request): Promise<Response> {
  return dataExportResponse(request);
}
