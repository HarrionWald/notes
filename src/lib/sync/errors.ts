export function explainSyncError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("quota") || text.includes("exceeded") || text.includes("payload too large") || text.includes("entity too large") || text.includes("413")) {
    return "The free Supabase quota or file-size limit was reached. Your work is still saved on this device. Delete old recordings or documents, or wait for the quota to reset. This app will not upgrade the plan.";
  }
  if (text.includes("row-level security") || text.includes("permission denied") || text.includes("jwt")) {
    return "The server rejected this change because the account is not allowed to write it. Sign in again. Nothing unsaved was discarded.";
  }
  if (text.includes("relation") || text.includes("schema cache") || text.includes("does not exist")) {
    return "The database tables are missing. Run the SQL migration in the Supabase SQL editor, then retry sync.";
  }
  if (text.includes("failed to fetch") || text.includes("network") || text.includes("offline")) {
    return "The network request failed. Changes stay on this device until you retry.";
  }
  if (text.includes("email address not authorized") || text.includes("rate limit")) {
    return "Supabase’s free email service refused the message. Use the email on your Supabase account, or set a password from the Supabase dashboard.";
  }
  return message || "The change could not be synchronized. It is still saved on this device.";
}

export function recordingErrorMessage(error: { name?: string; message?: string }) {
  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone permission was denied. Recording did not start. You can allow the microphone in the browser site settings and try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found. Plug one in or try another browser, then start recording again.";
    case "NotReadableError":
      return "The microphone is busy in another app. Close that app and try again.";
    case "SecurityError":
      return "The browser blocked microphone access. Recording only works on a secure page (https or localhost).";
    default:
      return error.message || "Recording could not start.";
  }
}

export function speechUnavailableMessage() {
  return "This browser does not expose speech recognition. You can still record audio, type a transcript, or import a transcript text file. Automatic transcription is not guaranteed.";
}
