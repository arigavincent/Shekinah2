import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, API_BASE_URL } from "../api/client";
import { getToken } from "../auth/session";
import { nairobiNow } from "../publishing/queue";
type Record = {
  id: string;
  name: string;
  email: string;
  occasion: string;
  date: string;
  method: string;
  by: string;
  createdAt: string;
};
type Attendance = {
  records: Record[];
  occasions: { name: string; count: number }[];
  days: { name: string; count: number }[];
};
type QRDetector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
export function CheckInPage() {
  const [date, setDate] = useState(nairobiNow().slice(0, 10)),
    [occasion, setOccasion] = useState(""),
    [scanOccasion, setScanOccasion] = useState("Service"),
    [code, setCode] = useState(""),
    [data, setData] = useState<Attendance | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    media = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function closeCamera() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    setScanning(false);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      media.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const params = () => new URLSearchParams({ date, occasion }).toString();
  const load = useCallback(async () => {
    try {
      setData(
        await apiRequest<Attendance>(
          `/api/v1/attendance?${new URLSearchParams({ date, occasion })}`,
          { token: getToken() },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load attendance");
    }
  }, [date, occasion]);
  useEffect(() => {
    void load();
  }, [load]);
  async function scan(value = code) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await apiRequest<{
        name: string;
        already: boolean;
        occasion: string;
        count: number;
      }>("/api/v1/attendance/scan", {
        method: "POST",
        token: getToken(),
        body: { code: value.trim(), occasion: scanOccasion },
      });
      setNotice(
        `${r.name} · ${r.already ? "Already checked in" : "Checked in"} · ${r.occasion} · ${r.count} present`,
      );
      setCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check in");
    } finally {
      setBusy(false);
    }
  }
  async function camera() {
    setError("");
    try {
      const Constructor = (
        window as unknown as {
          BarcodeDetector?: new (options: { formats: string[] }) => QRDetector;
        }
      ).BarcodeDetector;
      if (!Constructor)
        throw Error(
          "Camera scanning is unavailable in this browser. Use the phone app, a USB QR scanner, or enter the code below.",
        );
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera scanning needs HTTPS or localhost. Enter the code below or use the app.",
        );
      const detector = new Constructor({ formats: ["qr_code"] });
      media.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (!video.current) throw Error("Camera preview unavailable");
      video.current.srcObject = media.current;
      setScanning(true);
      await video.current.play();
      const tick = async () => {
        if (!media.current || !video.current) return;
        try {
          const found = await detector.detect(video.current);
          if (found[0]?.rawValue) {
            const value = found[0].rawValue;
            closeCamera();
            setCode(value);
            await scan(value);
            return;
          }
        } catch {}
        timer.current = setTimeout(() => void tick(), 350);
      };
      void tick();
    } catch (e) {
      closeCamera();
      setError(e instanceof Error ? e.message : "Could not open camera");
    }
  }
  async function pdf() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/attendance/report.pdf?${params()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw Error("Could not export attendance");
      const u = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = u;
      a.download = `attendance-${date}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1>Member & event check-in</h1>
          <p className="muted">
            Scan member codes or event tickets. Confirmed payment is required for paid event
            tickets.
          </p>
        </div>
        <button className="secondary" onClick={() => void load()}>
          Refresh
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="editor-card">
        <h2>Gate check-in</h2>
        <label>
          Service / occasion
          <input value={scanOccasion} onChange={(e) => setScanOccasion(e.target.value)} />
        </label>
        <p className="small-muted">
          Event tickets automatically select their event. Member codes use this occasion and today’s
          Nairobi date.
        </p>
        <label>
          Member code or ticket
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter or scan code"
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.trim() && !busy) void scan();
            }}
          />
        </label>
        <video
          ref={video}
          muted
          autoPlay
          playsInline
          style={{ width: "100%", maxHeight: 320, display: scanning ? "block" : "none" }}
        />
        <div className="row-actions">
          <button disabled={busy || !code.trim()} onClick={() => void scan()}>
            {busy ? "Checking…" : "Check in"}
          </button>
          {scanning ? (
            <button className="secondary" onClick={closeCamera}>
              Close camera
            </button>
          ) : (
            <button className="secondary" disabled={busy} onClick={() => void camera()}>
              Scan QR with camera
            </button>
          )}
        </div>
      </section>
      <section className="list-card">
        <div className="section-title-row">
          <h2>Attendance records</h2>
          <button className="secondary" disabled={!data} onClick={() => void pdf()}>
            Export PDF
          </button>
        </div>
        <div className="two-col">
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Occasion
            <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              <option value="">All occasions</option>
              {data?.occasions.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name} ({o.count})
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">{data?.records.length || 0} people in this view.</p>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Occasion</th>
                <th>Method</th>
                <th>Checked in by</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {data?.records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <p className="cell-note">{r.email}</p>
                  </td>
                  <td>{r.occasion}</td>
                  <td>{r.method}</td>
                  <td>{r.by}</td>
                  <td>
                    {new Date(r.createdAt).toLocaleTimeString("en-KE", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.records.length && <p className="muted">No attendance recorded for this date.</p>}
      </section>
    </main>
  );
}
