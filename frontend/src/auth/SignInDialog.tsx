import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "./SessionProvider";
import { Button, Dialog, Icon, TextField } from "../components/m3";

/**
 * Sign-in is deliberately code-only: the player runs `/tracker link` in-game,
 * sees a 6-digit code in chat, and types it here. Nothing about the Minecraft
 * account is shared with the dashboard beyond the resulting username.
 */
export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setError("Enter the 6-digit code from chat.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(cleaned);
      onClose();
      navigate("/me");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sign in to your view"
      description="Private views show only your own observed activity."
      icon={<Icon name="wallet" size={22} />}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="filled" onClick={submit} loading={busy} icon="check">
            Sign in
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-container-high p-3 text-xs text-on-surface-variant">
          <p className="mb-1 font-medium text-on-surface">Get a code in-game</p>
          <p>
            Run <span className="rounded bg-surface-container-highest px-1.5 py-0.5 font-mono text-on-surface">/tracker link</span>{" "}
            on DonutSMP. A 6-digit code appears in chat and expires in a few minutes.
          </p>
        </div>

        <TextField
          label="Link code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="numeric"
          autoComplete="one-time-code"
          leadingIcon="lock"
          error={Boolean(error)}
          supportingText={error ?? "Single use, tied to your username."}
          className="text-center font-mono text-lg tracking-[0.4em]"
          autoFocus
        />
      </div>
    </Dialog>
  );
}
