import { Capacitor } from "@capacitor/core";

/**
 * Export only after the person presses an explicit Export/Share control.
 * Native files live in the temporary cache and are removed after the share sheet
 * finishes. The browser fallback uses an object URL, never a remote upload.
 */
export async function shareDocument({
  filename = "momentum-document.txt",
  text,
  mimeType = "text/plain",
}) {
  if (typeof text !== "string")
    throw new TypeError("The document must contain text.");
  const safeName = safeFilename(filename);

  if (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("Filesystem") &&
    Capacitor.isPluginAvailable("Share")
  ) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const unique =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `momentum-exports/${unique}-${safeName}`;
    let written = false;
    try {
      const file = await Filesystem.writeFile({
        path,
        data: text,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      written = true;
      await Share.share({
        title: safeName,
        files: [file.uri],
        dialogTitle: "Save or share from Momentum",
      });
      return { method: "native-share", cancelled: false };
    } catch (error) {
      if (isShareCancelled(error))
        return { method: "native-share", cancelled: true };
      throw new Error("The document could not be shared. Please try again.", {
        cause: error,
      });
    } finally {
      if (written) {
        try {
          await Filesystem.deleteFile({ path, directory: Directory.Cache });
        } catch {
          /* The OS may already have removed the temporary file. */
        }
      }
    }
  }

  const file = new File([text], safeName, { type: mimeType });
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: safeName });
      return { method: "web-share", cancelled: false };
    } catch (error) {
      if (isShareCancelled(error))
        return { method: "web-share", cancelled: true };
      // Browsers can advertise file sharing without supporting this file type.
      // An ordinary local download remains available after a rejected share.
    }
  }
  if (typeof document === "undefined")
    throw new Error("Downloads are not available in this environment.");
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow Safari enough time to read the object URL before revocation.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { method: "download", cancelled: false };
}

/** Keep paths out of the export filename, including on native filesystems. */
export function safeFilename(value) {
  const name = String(value || "momentum-document.txt")
    .split(/[\\/]/)
    .pop()
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return name || "momentum-document.txt";
}

function isShareCancelled(error) {
  return (
    error?.name === "AbortError" ||
    /\b(cancelled|canceled|user cancel)\b/i.test(error?.message || "")
  );
}

/** Tactile confirmation on supported devices; not required for app behavior. */
export async function lightHaptic() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("Haptics"))
    return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* Haptics are optional on devices without a supported motor. */
  }
}

/** Also clear abandoned share files when the person deletes all Momentum data. */
export async function clearNativeExportCache() {
  if (
    !Capacitor.isNativePlatform() ||
    !Capacitor.isPluginAvailable("Filesystem")
  )
    return;
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  try {
    await Filesystem.rmdir({
      path: "momentum-exports",
      directory: Directory.Cache,
      recursive: true,
    });
  } catch (error) {
    // Absence is normal for installations that have never exported a document.
    if (
      !/not exist|not found|no such file|couldn.t be opened because there is no such file/i.test(
        error?.message || "",
      )
    )
      throw error;
  }
}
