import { Text } from "@fluentui/react-components";
import type { ReactNode } from "react";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";
import { cx, toneClass, useDesktopStyles } from "./desktopStyles";
import { getCartridgeStatus, getProjectStatus } from "./status";

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
