import { useEffect } from "react";

export const useDialogAccessibility = (
  dialogRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) => {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusDialog = () => dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(focusDialog);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previous?.focus?.();
    };
  }, [dialogRef, open]);
};
