import { Spinner, Text } from "@fluentui/react-components";
import type { ReactNode } from "react";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";
import { cx, toneClass, useDesktopStyles } from "./desktopStyles";
import { getCartridgeStatus, getProjectStatus } from "./status";

export type OperationStatusKind =
  | "idle"
  | "pending"
  | "success"
  | "cancelled"
  | "blocked"
  | "error";

export function ScrollPane(props: {
  className?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const styles = useDesktopStyles();
  return (
    <div
      className={cx(styles.scrollPane, props.className)}
      aria-label={props.ariaLabel}
      tabIndex={0}
    >
      {props.children}
    </div>
  );
}

export function OperationStatusBar(props: {
  status: OperationStatusKind;
  message: string;
}) {
  const styles = useDesktopStyles();
  const assertive = props.status === "blocked" || props.status === "error";
  return (
    <div
      className={cx(
        styles.operationStatusBar,
        operationStatusClass(styles, props.status),
      )}
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span
        className={cx(
          styles.operationStatusIndicator,
          props.status === "pending" && styles.operationStatusIndicatorPending,
        )}
        aria-hidden="true"
      >
        {props.status === "pending" ? <Spinner size="tiny" /> : null}
      </span>
      <Text size={200} className={styles.operationStatusText}>
        {props.message}
      </Text>
    </div>
  );
}

export function StatusPill(props: {
  status: DesktopProjectSnapshot["status"];
}) {
  const styles = useDesktopStyles();
  const status = getProjectStatus(props.status);
  return (
    <span className={cx(styles.statusPill, toneClass(styles, status.tone))}>
      {status.label}
    </span>
  );
}

export function CartridgeStatusPill(props: {
  cartridge: DesktopCartridgeSnapshot;
}) {
  const styles = useDesktopStyles();
  const status = getCartridgeStatus(props.cartridge);
  return (
    <span className={cx(styles.statusPill, toneClass(styles, status.tone))}>
      {status.label}
    </span>
  );
}

export function EmptyState(props: { children: ReactNode }) {
  const styles = useDesktopStyles();
  return <div className={styles.emptyState}>{props.children}</div>;
}

export function SmallMuted(props: { children: ReactNode }) {
  const styles = useDesktopStyles();
  return (
    <Text size={200} className={styles.muted}>
      {props.children}
    </Text>
  );
}

function operationStatusClass(
  styles: ReturnType<typeof useDesktopStyles>,
  status: OperationStatusKind,
): string {
  if (status === "success") return styles.operationStatusSuccess;
  if (status === "cancelled") return styles.operationStatusCancelled;
  if (status === "blocked" || status === "error") {
    return styles.operationStatusDanger;
  }
  if (status === "pending") return styles.operationStatusPending;
  return styles.operationStatusIdle;
}
