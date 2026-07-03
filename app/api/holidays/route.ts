/**
 * GET /api/holidays?year=YYYY — get Singapore public holidays
 */
import { NextRequest, NextResponse } from "next/server";
import { holidayDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year))
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });

  const holidays = holidayDB.findByYear(year);
  return NextResponse.json(holidays);
}
