import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useViewMode, type ViewMode } from "../view/ViewModeProvider";
import { useSession } from "../auth/SessionProvider";
import { IconButton, SegmentedButton } from "./m3";

/**
 * Switching to the personal view requires a session, so selecting it while
 * signed out opens the sign-in dialog instead of leaving the player on an
 * empty page. The dialog flips the mode once sign-in succeeds.
 */
export function useViewSwitch() {
  const { mode, setMode } = useViewMode();
  const { username, openSignIn } = useSession();
  const navigate = useNavigate();

  const switchTo = useCallback(
    (next: ViewMode) => {
      if (next === "personal" && !username) {
        openSignIn();
        return;
      }
      setMode(next);
      navigate(next === "personal" ? "/me" : "/");
    },
    [username, openSignIn, setMode, navigate]
  );

  return { mode, switchTo };
}

export function ViewModeSwitch({
  className,
  fullWidth = false,
}: {
  className?: string;
  fullWidth?: boolean;
}) {
  const { mode, switchTo } = useViewSwitch();
  return (
    <SegmentedButton
      value={mode}
      onValueChange={switchTo}
      ariaLabel="Dashboard mode"
      size="sm"
      fullWidth={fullWidth}
      className={className}
      options={[
        { value: "public", label: "Public", icon: "eye" },
        { value: "personal", label: "Personal", icon: "lock" },
      ]}
    />
  );
}

/** Compact variant for the top app bar on wide screens. */
export function ViewModeIconButton() {
  const { mode, switchTo } = useViewSwitch();
  const personal = mode === "personal";
  return (
    <IconButton
      icon={personal ? "lock" : "eye"}
      label={personal ? "Switch to public dashboard" : "Switch to my private view"}
      onClick={() => switchTo(personal ? "public" : "personal")}
    />
  );
}
