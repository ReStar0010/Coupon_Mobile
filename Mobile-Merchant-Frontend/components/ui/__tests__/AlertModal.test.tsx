import fs from 'fs';
import path from 'path';

describe('AlertModal', () => {
  it('does not keep success or error messages in a fixed-height status container', () => {
    const filePath = path.join(__dirname, '..', 'AlertModal.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).not.toMatch(/statusContent:\s*\{[\s\S]*?height:\s*56/);
  });

  it('lets success or error modals override the default full-width card sizing', () => {
    const filePath = path.join(__dirname, '..', 'AlertModal.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toMatch(/statusContent:\s*\{[\s\S]*?width:\s*'auto'/);
    expect(source).toMatch(/statusContent:\s*\{[\s\S]*?maxWidth:\s*'85%'/);
  });
});
