import React, { useEffect, useMemo, useState, useRef } from "react";
import { parseBalanceFromNDEFMessage } from "../utils/ndef";

/**
 * NFC Reader:
 * - Detects if Web NFC is supported
 * - A  function stopScan() {
    console.log("🛑 Stopping NFC scan...");
    
    if (s        {error && (
          <div className="mt-2 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm whitespace-pre-line">
            {error}
          </div>
        )}

        {debugInfo && (
          <details className="mt-2" open={scanAttempts > 1}>
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
              🔍 Debug Information {scanAttempts > 0 && `(${scanAttempts} attempts)`}
            </summary>
            <div className="mt-1 p-2 rounded bg-slate-50 border text-xs font-mono text-slate-600 whitespace-pre-line max-h-40 overflow-y-auto">
              {debugInfo}
            </div>
          </details>
        )}

        {!supported && !mockMode && (
          <div className="text-xs text-slate-500 space-y-2">
            <div><b>⚠️ Web NFC Requirements:</b></div>
            <ul className="list-disc list-inside space-y-1">
              <li><b>Android Chrome</b> (version 89+)</li>
              <li><b>HTTPS connection</b> ✅</li>
              <li><b>NFC enabled</b> in device settings</li>
              <li><b>NDEF-compatible card</b> (some cards won't work)</li>
            </ul>
            <div className="mt-2">
              If you're testing on desktop, enable <b>Mock Mode</b> above.
            </div>
          </div>
        )}

        {supported && !mockMode && (
          <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded border">
            <b>📱 NFC Scanning Tips:</b>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Hold card steady against back of phone for 2-3 seconds</li>
              <li>Try different positions - NFC antenna location varies</li>
              <li>Remove thick phone cases</li>
              <li>Ensure card is clean and undamaged</li>
              <li><b>Many transit cards use MIFARE (not Web NFC compatible)</b></li>
              <li>Test with other NFC cards (business cards, tags) to verify NFC works</li>
            </ul>
          </div>
        )}f.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    readerRef.current = null;
    setScanning(false);
    setDebugInfo(prev => prev + "\n🛑 Scan stopped by user");
  }mock mode for desktop testing
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
  const [debugInfo, setDebugInfo] = useState("");
  const [cardDetected, setCardDetected] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const readerRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
    return () => {
      stopScan();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const status = useMemo(() => {
    if (mockMode) return "Mock Mode";
    if (!supported) return "Web NFC not supported";
    return scanning ? "Scanning..." : "Idle";
  }, [supported, scanning, mockMode]);

  async function startScan() {
    setError("");
    setDebugInfo("");
    setCardDetected(false);
    setScanAttempts((prev) => prev + 1);

    if (mockMode) {
      // Simulate a card scan
      const fakeBalance = Math.round((Math.random() * 400 + 50) * 100) / 100;
      setTimeout(() => {
        setLastBalance(fakeBalance);
        setCardId(`MOCK-${Math.random().toString(36).slice(2, 8)}`);
        onBalance?.(fakeBalance);
        setDebugInfo("✅ Mock scan completed successfully");
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
      console.log(`🚀 Starting NFC scan attempt #${scanAttempts + 1}`);
      setDebugInfo(
        `📱 Scan attempt #${scanAttempts + 1}\n⏳ Initializing NFC scanner...`
      );

      const reader = new window.NDEFReader();
      readerRef.current = reader;

      // Add scan timeout to prevent hanging
      scanTimeoutRef.current = setTimeout(() => {
        if (scanning) {
          console.log("⏰ NFC scan timeout - no card detected");
          setScanning(false);
          setError(
            "⏰ Scan timeout - No NFC card detected.\n\nPossible issues:\n• Card is not NFC-enabled\n• Card uses different technology (MIFARE, etc.)\n• NFC antenna position doesn't match\n• Phone case blocking signal\n• Card is damaged\n\nTry:\n• Different card positions\n• Remove phone case\n• Test with a different NFC card\n• Check if other NFC apps work"
          );
          setDebugInfo(
            (prev) => prev + "\n⏰ Timeout: No card detected within 8 seconds"
          );
        }
      }, 8000);

      await reader.scan();
      setScanning(true);
      setDebugInfo(
        (prev) => prev + "\n📡 NFC scanner active - hold card near device"
      );

      reader.onreadingerror = (event) => {
        console.error("❌ NFC reading error:", event);
        setScanning(false);
        clearTimeout(scanTimeoutRef.current);

        let errorType = "Unknown";
        let specificAdvice = "";

        if (event?.error) {
          errorType = event.error.name;
          console.log("Error details:", event.error);

          switch (event.error.name) {
            case "NotAllowedError":
              specificAdvice =
                "🔒 NFC permission denied.\n\nSolutions:\n• Allow NFC access in browser\n• Check device NFC permissions\n• Restart browser and try again";
              break;
            case "NotSupportedError":
              specificAdvice =
                "📵 NFC not supported.\n\nRequirements:\n• Android device with NFC\n• Chrome browser (latest)\n• NFC enabled in settings";
              break;
            case "InvalidStateError":
              specificAdvice =
                "⚙️ NFC scanner state error.\n\nSolutions:\n• Close other NFC apps\n• Restart browser\n• Turn NFC off/on in settings";
              break;
            case "NotReadableError":
              specificAdvice =
                "📄 Card data not readable.\n\nPossible causes:\n• Card is encrypted/protected\n• Wrong card type (not NDEF)\n• Card uses proprietary format\n• Physical damage to card\n\nThis is common with:\n• Transit cards (they often use MIFARE)\n• Bank cards (encrypted)\n• Access cards (proprietary)";
              break;
            case "AbortError":
              specificAdvice =
                "🛑 Scan was cancelled.\n\nThis is normal if you stopped the scan.";
              break;
            default:
              specificAdvice = `⚠️ ${errorType} error.\n\nGeneral solutions:\n• Hold card steady for 3-4 seconds\n• Try different positions\n• Ensure card is clean\n• Check NFC is enabled\n• Try with a different NFC-enabled card`;
          }
        } else {
          specificAdvice =
            "⚠️ Generic NFC reading error.\n\nSolutions:\n• Hold card steady for 3-4 seconds\n• Try different positions on phone\n• Ensure card is clean and undamaged\n• Make sure NFC is enabled\n• Try restarting the scan\n• Test with a different NFC card";
        }

        setError(specificAdvice);
        setDebugInfo(
          (prev) =>
            prev +
            `\n❌ Error: ${errorType} - ${
              event?.error?.message || "No additional details"
            }`
        );
      };

      reader.onreading = (event) => {
        try {
          setScanning(false);
          setCardDetected(true);
          clearTimeout(scanTimeoutRef.current);

          const { message, serialNumber } = event;
          console.log("✅ NFC data received:", { message, serialNumber });

          const recordCount = message?.records?.length || 0;
          setDebugInfo(
            (prev) =>
              prev +
              `\n✅ Card detected!\n📄 Serial: ${
                serialNumber || "Unknown"
              }\n📊 Records: ${recordCount}`
          );

          let balance = null;

          try {
            balance = parseBalanceFromNDEFMessage(message);
            if (balance !== null) {
              setDebugInfo((prev) => prev + `\n💰 Balance found: ৳${balance}`);
            }
          } catch (parseErr) {
            console.warn("Parse error:", parseErr);
            setDebugInfo(
              (prev) => prev + `\n⚠️ Parse error: ${parseErr.message}`
            );
            balance = null;
          }

          setCardId(serialNumber || "(unknown)");

          if (balance !== null) {
            setLastBalance(balance);
            onBalance?.(balance);
            setError("");
            setDebugInfo((prev) => prev + "\n🎉 Success! Balance loaded.");
          } else {
            // Card detected but no balance - provide detailed info
            const recordTypes =
              message?.records?.map((r) => r.recordType).join(", ") || "none";

            setError(
              `✅ NFC Card Successfully Detected!\n\n📋 Card Information:\n• Serial: ${
                serialNumber || "Unknown"
              }\n• Records: ${recordCount}\n• Types: ${recordTypes}\n\n⚠️ However, no balance data found.\n\nThis could mean:\n• Card uses encrypted format\n• Balance stored in proprietary format\n• Card is not a metro/transit card\n• Different parsing method needed\n\n💡 Your card IS working with NFC - it's just using a format we can't parse yet.`
            );

            setDebugInfo(
              (prev) =>
                prev +
                `\n⚠️ Balance parsing failed\n📋 Record types: ${recordTypes}`
            );
          }
        } catch (e) {
          console.error("Processing error:", e);
          setError(`❌ Failed to process NFC data: ${e.message}`);
          setDebugInfo((prev) => prev + `\n❌ Processing error: ${e.message}`);
          setScanning(false);
        }
      };
    } catch (err) {
      console.error("Scan start error:", err);
      setScanning(false);
      clearTimeout(scanTimeoutRef.current);

      let errorMessage = "❌ Failed to start NFC scan.\n\n";

      switch (err.name) {
        case "NotAllowedError":
          errorMessage +=
            "🔒 Permission denied.\n\nSolutions:\n• Allow NFC permissions\n• Check browser settings\n• Restart browser";
          break;
        case "NotSupportedError":
          errorMessage +=
            "📵 NFC not supported.\n\nRequirements:\n• Android Chrome browser\n• Device with NFC hardware\n• NFC enabled in settings";
          break;
        default:
          errorMessage += `${
            err.message || "Unknown error"
          }\n\nTry:\n• Refresh page\n• Check browser console\n• Ensure proper permissions`;
      }

      setError(errorMessage);
      setDebugInfo(`❌ Start error: ${err.name} - ${err.message}`);
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
            className="px-4 py-2 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:bg-gray-400"
            disabled={scanning}
          >
            {scanning
              ? "Scanning..."
              : mockMode
              ? "Simulate Scan"
              : `Start Scan${scanAttempts > 0 ? ` (${scanAttempts})` : ""}`}
          </button>
          <button
            onClick={stopScan}
            className="px-4 py-2 rounded-md border bg-slate-100 hover:bg-slate-200 transition"
            disabled={!scanning}
          >
            Stop
          </button>
          {scanAttempts > 0 && (
            <button
              onClick={() => {
                setScanAttempts(0);
                setDebugInfo("");
                setError("");
                setCardDetected(false);
              }}
              className="px-3 py-2 rounded-md border bg-blue-100 hover:bg-blue-200 transition text-sm"
            >
              Reset
            </button>
          )}
        </div>

        {cardDetected && !lastBalance && (
          <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-sm font-medium text-blue-800">
              🎉 NFC Card Detected!
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Your card is working with NFC, but uses a format we can't parse
              yet.
            </div>
          </div>
        )}

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
