import { describe, expect, it, vi } from "vitest";
// Inspect the actual style specification without claiming browser layout coverage.
vi.mock("@fluentui/react-components", () => ({ makeStyles: (styles: unknown) => () => styles }));
import { useDesktopStyles } from "../desktop/renderer/desktopStyles.js";
import { useDetailStyles } from "../desktop/renderer/detailStyles.js";
describe("Desktop allowed-width constraints", () => {
  it.each([980, 1100, 1240])("fits shrinkable columns within %ipx without raising window minimum", width => {
    const styles = useDesktopStyles() as unknown as Record<string, Record<string, string | number>>;
    const columns = String(styles.shell.gridTemplateColumns);
    const fixed = Number(columns.match(/^(\d+)px/)?.[1]);
    const tracks = [...columns.matchAll(/minmax\((\d+)(?:px)?,\s*([\d.]+)fr\)/g)].map(match => ({ min: Number(match[1]), fr: Number(match[2]) }));
    expect(tracks).toHaveLength(2);
    expect(fixed + tracks.reduce((sum, track) => sum + track.min, 0)).toBeLessThanOrEqual(width);
    const unit = (width - fixed) / tracks.reduce((sum, track) => sum + track.fr, 0);
    const center = Math.max(tracks[0].min, unit * tracks[0].fr);
    const detail = width - fixed - center;
    expect(detail).toBeGreaterThanOrEqual(400);
    expect(styles.centerColumn.minWidth).toBe(0); expect(styles.detailColumn.minWidth).toBe(0);
    const detailStyles = useDetailStyles() as unknown as Record<string, Record<string, string | number>>;
    expect(detailStyles.cartridgeRow.gridTemplateColumns).toBe("minmax(0, 1fr) 58px");
    expect(detailStyles.drawerPanel.width).toBe("min(100%, 560px)");
    expect(styles.settingsPanel.width).toBe("min(100%, 420px)");
  });
});
