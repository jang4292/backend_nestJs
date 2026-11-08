export const PASSWORD_HASHER_PORT = Symbol('PasswordHasherPort');

export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  /**
   * hash가 null(비밀번호가 없는 계정, 존재하지 않는 계정)이어도 동일한 비용의 비교를 수행하고
   * false를 반환합니다. 응답 시간 차이로 계정 존재 여부가 드러나지 않게 하기 위함입니다.
   */
  compare(plainPassword: string, hash: string | null): Promise<boolean>;
}
