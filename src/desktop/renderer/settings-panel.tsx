import { Button, Divider, Switch, Text, Tooltip } from "@fluentui/react-components";
import { Dismiss20Regular, Settings20Regular } from "@fluentui/react-icons";
import type { DesktopSettings } from "../project-store";
import { useDesktopStyles } from "./desktopStyles";

export function SettingsPanel(props: {
  settings: DesktopSettings;
  onClose: () => void;
  onChange: (patch: Partial<DesktopSettings>) => void;
}) {
  const styles = useDesktopStyles();
  return (
    <section className={styles.settingsPanel}>
      <div className={styles.settingHeader}>
        <Settings20Regular />
        <Text weight="semibold">設定</Text>
        <Tooltip content="關閉設定" relationship="label">
          <Button
            icon={<Dismiss20Regular />}
            appearance="subtle"
            size="small"
            onClick={props.onClose}
          />
        </Tooltip>
      </div>
      <div className={styles.settingsGrid}>
        <SettingSwitch
          title="按 X 縮到系統匣"
          description="視窗會消失，但監控繼續在右下角運作。"
          checked={props.settings.minimizeToTray}
          onChange={(checked) => props.onChange({ minimizeToTray: checked })}
        />
        <Divider />
        <SettingSwitch
          title="顯示桌面通知"
          description="專案變成阻塞或錯誤時彈出提醒。"
          checked={props.settings.notificationsEnabled}
          onChange={(checked) => props.onChange({ notificationsEnabled: checked })}
        />
        <Divider />
        <SettingSwitch
          title="顯示新手說明"
          description="在總覽上方保留簡短說明。"
          checked={props.settings.showIntro}
          onChange={(checked) => props.onChange({ showIntro: checked })}
        />
      </div>
    </section>
  );
}

function SettingSwitch(props: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const styles = useDesktopStyles();
  return (
    <div className={styles.settingRow}>
      <div className={styles.brandBlock}>
        <Text weight="semibold">{props.title}</Text>
        <Text size={200} className={styles.muted}>
          {props.description}
        </Text>
      </div>
      <Switch
        checked={props.checked}
        onChange={(_event, data) => props.onChange(Boolean(data.checked))}
      />
    </div>
  );
}
