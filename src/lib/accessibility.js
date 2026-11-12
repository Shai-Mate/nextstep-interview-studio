/** Roving focus for horizontal tab lists, including assistive-keyboard users. */
export function handleTabKeys(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  tabs[next].focus();
  tabs[next].click();
  tabs[next].scrollIntoView({ block: "nearest", inline: "nearest" });
}
