import Papa from "papaparse";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 });

    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });

    const id = match[1];
    
    let gid = "0";
    const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
    if (gidMatch) {
      gid = gidMatch[1];
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    
    const r = await fetch(exportUrl);
    if (!r.ok) {
      return NextResponse.json({ error: "Không thể tải Google Sheet. Vui lòng kiểm tra lại quyền chia sẻ 'Bất kỳ ai có liên kết đều có thể xem'." }, { status: 400 });
    }

    const csvText = await r.text();
    if (csvText.includes("<html") && csvText.includes("<body")) {
        return NextResponse.json({ error: "Không thể tải Google Sheet. Vui lòng bật chế độ 'Bất kỳ ai có liên kết đều có thể xem'." }, { status: 400 });
    }
    
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    return NextResponse.json(parsed.data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
