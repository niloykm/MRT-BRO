import React, { useEffect, useMemo, useState, useRef } from "react";
import { parseBalanceFromNDEFMessage } from "../utils/ndef";

/**
 * NFC Reader:
 * - Detects if Web NFC is supported
 * - Allows mock mode for desktop testing
 * - Start / Stop scanning
 * - Reads card ID + balance (via parseBalanceFromNDEFMessage)
 */
export default function NFCReader({ onBalance }) {
  const [supported, setSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [lastBalance, setLastBalance] = useState(null);
  const [cardId, setCardId] = useState(null);
  const readerRef = useRef(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
    return () => stopScan(); // cleanup on unmount
  }, []);

  const status = useMemo(() => {
    if (mockMode) return "Mock Mode";
    if (!supported) return "Web NFC not supported";
    return scanning ? "Scanning..." : "Idle";
  }, [supported, scanning, mockMode]);

  async function startScan() {
    setError("");
    if (mockMode) {
      // Simulate a card scan
      const fakeBalance = Math.round((Math.random() * 400 + 50) * 100) / 100;
      setTimeout(() => {
        setLastBalance(fakeBalance);
        setCardId(`MOCK-${Math.random().toString(36).slice(2, 8)}`);
        onBalance?.(fakeBalance);
      }, 600);
      return;
    }

    if (!supported) {
      setError(
        "❌ This device/browser doesn't support Web NFC. Try Android Chrome over HTTPS."
      );
      return;
    }

    try {
      const reader = new window.NDEFReader();
      readerRef.current = reader;
      await reader.scan();
      setScanning(true);

      reader.onreadingerror = (event) => {
        console.error("NFC reading error:", event);
        setScanning(false);
        setError(
          "⚠️ NFC reading issue. Please:\n• Hold card steady for 3-4 seconds\n• Try different positions on your phone\n• Ensure card is clean and undamaged\n• Make sure NFC is enabled in settings\n• Try restarting the scan"
        );
      };

      reader.onreading = (event) => {
        try {
          setScanning(false);
          const { message, serialNumber } = event;
          console.log("NFC data received:", { message, serialNumber });

          let balance = null;

          try {
            balance = parseBalanceFromNDEFMessage(message);
          } catch (parseErr) {
            console.warn("Parse error:", parseErr);
            balance = null;
          }

          setCardId(serialNumber || "(unknown)");
          if (balance != null) {
            setLastBalance(balance);
            onBalance?.(balance);
            setError(""); // Clear any previous errors
          } else {
            setError(
              "✅ Card detected! However, balance could not be parsed from this card.\n\nCard ID: " +
                (serialNumber || "Unknown") +
                "\n\nThis card may:\n• Use a different format\n• Be encrypted or protected\n• Not be a metro/transit card"
            );
          }
        } catch (e) {
          console.error(e);
          setError("❌ Failed to read NFC data: " + e.message);
          setScanning(false);
        }
      };
    } catch (err) {
      console.error(err);
      setError(err?.message || "❌ Failed to start NFC scan.");
      setScanning(false);
    }
  }

  function stopScan() {
    // Web NFC API doesn’t have explicit stop()
    // Scanning auto-stops when page loses focus
    readerRef.current = null;
    setScanning(false);
  }

  return (
    <div className="p-4 rounded-xl bg-white shadow border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Metro Card – NFC Scanner</h2>
        <span className="text-xs px-2 py-1 rounded bg-slate-100">{status}</span>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={mockMode}
            onChange={(e) => setMockMode(e.target.checked)}
          />
          Enable Mock Mode (desktop testing)
        </label>

        <div className="flex gap-2">
          <button
            onClick={startScan}
            className="px-4 py-2 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 transition"
            disabled={scanning}
          >
            {mockMode ? "Simulate Scan" : "Start Scan"}
          </button>
          <button
            onClick={stopScan}
            className="px-4 py-2 rounded-md border bg-slate-100 hover:bg-slate-200 transition"
          >
            Stop
          </button>
        </div>

        {lastBalance != null && (
          <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-sm text-slate-600">Card ID</div>
            <div className="font-mono text-slate-800">{cardId || "N/A"}</div>
            <div className="mt-2 text-sm text-slate-600">Current Balance</div>
            <div className="text-2xl font-bold">৳ {lastBalance.toFixed(2)}</div>
          </div>
        )}

        {error && (
          <div className="mt-2 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!supported && !mockMode && (
          <div className="text-xs text-slate-500">
            Tip: Web NFC currently works on <b>Android Chrome</b> over{" "}
            <b>HTTPS</b>. If you’re testing on desktop, enable <b>Mock Mode</b>.
          </div>
        )}
      </div>
    </div>
  );
}
