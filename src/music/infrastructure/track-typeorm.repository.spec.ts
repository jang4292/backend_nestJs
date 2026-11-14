import { escapeLike } from '../../common/database/escape-like';

describe('escapeLike', () => {
  it('leaves ordinary search terms unchanged', () => {
    expect(escapeLike('Love Song 2026')).toBe('Love Song 2026');
  });

  // %와 _를 그대로 두면 사용자가 패턴을 조작할 수 있습니다(예: "%"로 전체 조회, "_"로 임의 문자).
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('100%_off\\')).toBe('100\\%\\_off\\\\');
  });

  it('supports an explicit escape character without changing other text', () => {
    expect(escapeLike('100%!_𠀀\\', '!')).toBe('100!%!!!_𠀀\\');
  });
});
