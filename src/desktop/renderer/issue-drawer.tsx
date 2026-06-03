import { Button, Text, Tooltip } from "@fluentui/react-components";
import { Dismiss20Regular, FolderOpen20Regular } from "@fluentui/react-icons";
import type { ReactNode } from "react";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
  DesktopUntrackedFileSnapshot,
} from "../../monitoring/project-snapshot";
import type { DesktopOperationResult } from "../ipc-channels";
import { desktopApi } from "./desktop-api";
import { useDesktopStyles } from "./desktopStyles";
import { useDetailStyles } from "./detailStyles";
import { cartridgesForIssue, type IssueSelection } from "./status";

export function IssueDrawer(props: {
  project: DesktopProjectSnapshot;
  selection: IssueSelection;
  onClose: () => void;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
  onCopyText: (text: string) => void;
}) {
  const target = resolveIssueTarget(props.project, props.selection);
  if (!target) return null;
  return (
    <DrawerShell title={target.title} subtitle={target.subtitle} onClose={props.onClose}>
      {target.type === "untracked" ? (
        <UntrackedGuidance
          project={props.project}
          file={target.file}
          onOperation={props.onOperation}
          onCopyText={props.onCopyText}
        />
      ) : (
        <CartridgeGuidance
          project={props.project}
          cartridge={target.cartridge}
          onOperation={props.onOperation}
          onCopyText={props.onCopyText}
        />
      )}
    </DrawerShell>
  );
}

function DrawerShell(props: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  return (
    <section className={detail.drawerPanel} aria-label="問題處理導引">
      <div className={detail.drawerHeader}>
        <div className={styles.brandBlock}>
          <Text weight="semibold">{props.title}</Text>
          <Text size={200} className={styles.muted}>
            {props.subtitle}
          </Text>
        </div>
        <Tooltip content="關閉導引" relationship="label">
          <Button
            icon={<Dismiss20Regular />}
            appearance="subtle"
            size="small"
            onClick={props.onClose}
          />
        </Tooltip>
      </div>
      <div className={detail.drawerContent}>{props.children}</div>
    </section>
  );
}

function CartridgeGuidance(props: {
  project: DesktopProjectSnapshot;
  cartridge: DesktopCartridgeSnapshot;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
  onCopyText: (text: string) => void;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  const prompt = buildCartridgePrompt(props.cartridge);
  return (
    <>
      <section className={detail.drawerSection}>
        <Text weight="semibold">為什麼需要處理</Text>
        <Text size={200} className={styles.muted}>
          {props.cartridge.guidance}
        </Text>
        <div className={detail.sectionActions}>
          <Button
            size="small"
            onClick={() =>
              props.onOperation(
                "正在開啟記憶卡...",
                desktopApi.openFile(props.project.root, props.cartridge.skillPath),
              )
            }
          >
            開啟記憶卡
          </Button>
          <Button
            size="small"
            icon={<FolderOpen20Regular />}
            onClick={() =>
              props.onOperation(
                "正在開啟專案資料夾...",
                desktopApi.openProject(props.project.root),
              )
            }
          >
            專案資料夾
          </Button>
          <Button size="small" onClick={() => props.onCopyText(prompt)}>
            複製提示
          </Button>
        </div>
      </section>

      {props.cartridge.compaction && (
        <section className={detail.drawerSection}>
          <Text weight="semibold">壓縮治理</Text>
          <Text size={200} className={styles.muted}>
            {formatCompactionSummary(props.cartridge)}
          </Text>
        </section>
      )}

      <FileSection
        title="造成過期的檔案"
        emptyText="沒有待處理異動檔案。"
        files={props.cartridge.pendingChangeFiles.map((item) => ({
          path: item.filePath,
          meta: `${item.label} · ${item.timestamp}`,
          openable: true,
        }))}
        onOpen={(filePath) =>
          props.onOperation(
            "正在開啟造成過期的檔案...",
            desktopApi.openFile(props.project.root, filePath),
          )
        }
      />
      <FileSection
        title="幽靈檔案"
        emptyText="沒有幽靈檔案。"
        files={props.cartridge.ghostFilePaths.map((filePath) => ({
          path: filePath,
          meta: "檔案已不存在，請從記憶卡 Tracked Files 移除。",
          openable: false,
        }))}
      />
      <FileSection
        title="目前追蹤檔案"
        emptyText="這張卡目前沒有追蹤檔案。"
        files={props.cartridge.trackedFiles.map((filePath) => ({
          path: filePath,
          meta: "已被這張記憶卡追蹤",
          openable: true,
        }))}
        onOpen={(filePath) =>
          props.onOperation(
            "正在開啟追蹤檔案...",
            desktopApi.openFile(props.project.root, filePath),
          )
        }
      />
    </>
  );
}

function UntrackedGuidance(props: {
  project: DesktopProjectSnapshot;
  file: DesktopUntrackedFileSnapshot;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
  onCopyText: (text: string) => void;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  const suggested = props.project.cartridges.find(
    (cartridge) => cartridge.id === props.file.suggestedOwner,
  );
  const prompt = buildUntrackedPrompt(props.file);
  return (
    <>
      <section className={detail.drawerSection}>
        <Text weight="semibold">為什麼需要處理</Text>
        <Text size={200} className={styles.muted}>
          {props.file.guidance}
        </Text>
        <div className={detail.sectionActions}>
          <Button
            size="small"
            onClick={() =>
              props.onOperation(
                "正在開啟新檔案...",
                desktopApi.openFile(props.project.root, props.file.filePath),
              )
            }
          >
            開啟新檔案
          </Button>
          <Button
            size="small"
            disabled={!suggested}
            onClick={() =>
              suggested &&
              props.onOperation(
                "正在開啟建議記憶卡...",
                desktopApi.openFile(props.project.root, suggested.skillPath),
              )
            }
          >
            開啟建議記憶卡
          </Button>
          <Button size="small" onClick={() => props.onCopyText(prompt)}>
            複製提示
          </Button>
        </div>
      </section>
      <section className={detail.drawerSection}>
        <Text weight="semibold">建議歸屬</Text>
        <Text size={200} className={styles.muted}>
          {props.file.suggestedOwner ?? "尚無建議，需要由使用者判斷。"}
        </Text>
      </section>
      <FileSection
        title="未歸屬檔案"
        emptyText="沒有未歸屬檔案。"
        files={[
          {
            path: props.file.filePath,
            meta: `${eventLabel(props.file.lastEvent)} · ${props.file.detectedAt}`,
            openable: true,
          },
        ]}
        onOpen={(filePath) =>
          props.onOperation(
            "正在開啟未歸屬檔案...",
            desktopApi.openFile(props.project.root, filePath),
          )
        }
      />
    </>
  );
}

function FileSection(props: {
  title: string;
  emptyText: string;
  files: Array<{ path: string; meta: string; openable: boolean }>;
  onOpen?: (filePath: string) => void;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  return (
    <section className={detail.drawerSection}>
      <Text weight="semibold">{props.title}</Text>
      {props.files.length === 0 ? (
        <Text size={200} className={styles.muted}>
          {props.emptyText}
        </Text>
      ) : (
        <div className={detail.fileList}>
          {props.files.map((file) => (
            <div key={file.path} className={detail.fileListItem}>
              <div className={styles.brandBlock}>
                <Text weight="semibold" className={detail.pathCell}>
                  {file.path}
                </Text>
                <Text size={200} className={styles.muted}>
                  {file.meta}
                </Text>
              </div>
              {file.openable && props.onOpen && (
                <Button size="small" onClick={() => props.onOpen?.(file.path)}>
                  開啟
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function resolveIssueTarget(
  project: DesktopProjectSnapshot,
  selection: IssueSelection,
):
  | {
      type: "cartridge";
      title: string;
      subtitle: string;
      cartridge: DesktopCartridgeSnapshot;
    }
  | {
      type: "untracked";
      title: string;
      subtitle: string;
      file: DesktopUntrackedFileSnapshot;
    }
  | null {
  if (selection.kind === "untracked") {
    const file =
      project.untrackedFiles.find((item) => item.filePath === selection.filePath) ??
      project.untrackedFiles[0];
    if (!file) return null;
    return {
      type: "untracked",
      title: "未歸屬檔案",
      subtitle: file.filePath,
      file,
    };
  }
  const candidates = cartridgesForIssue(project, selection.kind);
  const cartridge =
    candidates.find((item) => item.id === selection.cartridgeId) ?? candidates[0];
  if (!cartridge) return null;
  return {
    type: "cartridge",
    title: issueTitle(selection.kind),
    subtitle: cartridge.id,
    cartridge,
  };
}

function issueTitle(kind: IssueSelection["kind"]): string {
  if (kind === "ghost") return "幽靈檔案";
  if (kind === "review") return "複審提醒";
  return "阻塞記憶卡";
}

function buildCartridgePrompt(cartridge: DesktopCartridgeSnapshot): string {
  const pending = cartridge.pendingChangeFiles.map((item) => item.filePath).join(", ");
  const ghosts = cartridge.ghostFilePaths.join(", ");
  const compaction = cartridge.compaction
    ? `壓縮狀態：${formatCompactionSummary(cartridge)}`
    : "沒有壓縮治理度量。";
  return [
    `請檢查記憶卡 ${cartridge.id}。`,
    cartridge.guidance,
    compaction,
    pending ? `待處理檔案：${pending}` : "沒有待處理異動檔案。",
    ghosts ? `幽靈檔案：${ghosts}` : "沒有幽靈檔案。",
  ].join("\n");
}

function formatCompactionSummary(cartridge: DesktopCartridgeSnapshot): string {
  const metrics = cartridge.compaction;
  if (!metrics) return "尚無壓縮治理度量。";
  const advice =
    metrics.needsCompaction
      ? "需要先彙整或拆卡"
      : metrics.isLegacy
        ? "待懶升級"
        : cartridge.trackedFiles.length > 8
          ? "建議評估拆分"
          : metrics.reasons.includes("highChineseRatio")
            ? "建議降低主體中文比例"
            : "目前健康";
  return [
    `${metrics.cardKind} / ${metrics.compactionStatus}`,
    `大小 ${metrics.sizeBytes}/${metrics.sizeLimitBytes} bytes`,
    `行數 ${metrics.lineCount}/${metrics.lineLimit ?? "無上限"}`,
    `週期 ${metrics.cycleEventCount}/${metrics.cycleEventLimit}`,
    advice,
  ].join(" · ");
}

function buildUntrackedPrompt(file: DesktopUntrackedFileSnapshot): string {
  return [
    `請判斷未歸屬檔案 ${file.filePath} 應該加入哪張記憶卡。`,
    `建議歸屬：${file.suggestedOwner ?? "尚無建議"}`,
    file.guidance,
  ].join("\n");
}

function eventLabel(eventType: DesktopUntrackedFileSnapshot["lastEvent"]): string {
  if (eventType === "add") return "新增";
  if (eventType === "unlink") return "刪除";
  return "變更";
}
