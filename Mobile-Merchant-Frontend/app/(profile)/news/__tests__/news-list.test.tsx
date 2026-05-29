/**
 * Source-level tests for the StoreNews CRUD screens.
 *
 * The existing merchant repo does not yet wire up react-native renderer tests
 * (jest-expo is installed but only `*.unit.test.ts` style suites exist today),
 * so we follow the same lightweight pattern as components/ui/__tests__/AlertModal.test.tsx
 * and assert on the source contracts that matter for Phase 10.
 */

import fs from 'fs';
import path from 'path';

const NEWS_DIR = path.join(__dirname, '..');
const LIST_SRC = fs.readFileSync(path.join(NEWS_DIR, 'index.tsx'), 'utf8');
const EDIT_SRC = fs.readFileSync(path.join(NEWS_DIR, 'edit.tsx'), 'utf8');
const PROFILE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'index.tsx'),
  'utf8',
);
const NEWS_API_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', '..', 'services', 'newsAPI.ts'),
  'utf8',
);

describe('news-list (source)', () => {
  it('calls listNews from newsAPI on focus', () => {
    expect(LIST_SRC).toMatch(/listNews\s*\(\s*\)/);
    expect(LIST_SRC).toMatch(/from '@\/services\/newsAPI'/);
  });

  it('renders an empty state with 尚未發布店家近況 copy and 新增 entrypoint', () => {
    expect(LIST_SRC).toMatch(/尚未發布店家近況/);
    expect(LIST_SRC).toMatch(/router\.push\('\/\(profile\)\/news\/edit'\)/);
  });

  it('supports pull-to-refresh via RefreshControl', () => {
    expect(LIST_SRC).toMatch(/RefreshControl/);
    expect(LIST_SRC).toMatch(/onRefresh=\{handleRefresh\}/);
  });

  it('confirms deletion via Alert before calling deleteNews', () => {
    expect(LIST_SRC).toMatch(/Alert\.alert\(\s*'刪除近況'/);
    expect(LIST_SRC).toMatch(/deleteNews\(/);
  });

  it('computes ago text locally instead of trusting server-provided strings', () => {
    expect(LIST_SRC).toMatch(/function computeAgoText/);
    expect(LIST_SRC).toMatch(/剛剛|分鐘前|小時前|天前/);
  });
});

describe('news-edit (source)', () => {
  it('enforces a 200-character hard cap matching backend', () => {
    expect(EDIT_SRC).toMatch(/STORE_NEWS_MAX_LENGTH/);
    expect(EDIT_SRC).toMatch(/maxLength=\{STORE_NEWS_MAX_LENGTH\}/);
    expect(NEWS_API_SRC).toMatch(/STORE_NEWS_MAX_LENGTH\s*=\s*200/);
  });

  it('shows a live character counter', () => {
    expect(EDIT_SRC).toMatch(/body\.length\s*\}\s*\/\s*\$\{STORE_NEWS_MAX_LENGTH/);
  });

  it('surfaces 400 / 429 errors inline rather than as a generic Alert', () => {
    expect(EDIT_SRC).toMatch(/status === 400 \|\| status === 429/);
    expect(EDIT_SRC).toMatch(/setInlineError/);
  });

  it('navigates back on successful create', () => {
    expect(EDIT_SRC).toMatch(/await createNews\(trimmed\)/);
    expect(EDIT_SRC).toMatch(/router\.back\(\)/);
  });
});

describe('profile entrypoint (source)', () => {
  it('exposes a 店家近況管理 link that routes into /(profile)/news', () => {
    expect(PROFILE_SRC).toMatch(/店家近況管理/);
    expect(PROFILE_SRC).toMatch(/router\.push\('\/\(profile\)\/news'\)/);
  });
});
