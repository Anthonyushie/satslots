"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon, useExperience } from "./experience-context";

export function NativeDialog({
  id,
  labelledBy,
  active,
  children,
}: {
  id: string;
  labelledBy: string;
  active: boolean;
  children: ReactNode;
}) {
  const { closeModal, restoreFocus } = useExperience();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdropPress = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;
    const body = document.body;
    const hadClass = body.classList.contains("dialog-open");
    const overflow = body.style.overflow;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    body.classList.add("dialog-open");
    body.style.overflow = "hidden";
    return () => {
      // Cleanup also runs during StrictMode's effect replay. The onClose guard
      // ignores a queued native close event if this dialog has reopened.
      if (dialog.open) dialog.close();
      if (!hadClass) body.classList.remove("dialog-open");
      body.style.overflow = overflow;
      backdropPress.current = false;
      restoreFocus();
    };
  }, [active, restoreFocus]);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className="site-dialog"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      onClose={(event) => {
        if (active && !event.currentTarget.open) closeModal();
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        backdropPress.current =
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom);
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (
          backdropPress.current &&
          event.target === event.currentTarget &&
          outside
        )
          closeModal();
        backdropPress.current = false;
      }}
    >
      <div className="dialog-inner">{children}</div>
    </dialog>
  );
}

export function DialogTop({
  children,
  closeLabel,
}: {
  children: ReactNode;
  closeLabel: string;
}) {
  const { closeModal } = useExperience();
  return (
    <div className="dialog-top flex justify-between items-center">
      <span className="eyebrow">{children}</span>
      <button
        type="button"
        className="icon-button"
        data-close-dialog=""
        aria-label={closeLabel}
        onClick={closeModal}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
