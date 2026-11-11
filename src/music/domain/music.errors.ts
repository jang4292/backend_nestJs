import { ConflictError } from '../../common/errors/domain-error';

/**
 * 다른 데이터가 참조 중이라 삭제할 수 없음을 나타냅니다.
 * infrastructure가 DB FK 위반을 이 오류로 변환하고, GlobalExceptionFilter가 409로 응답합니다.
 */
export class ForeignKeyConstraintError extends ConflictError {
  constructor(message: string) {
    super(message, 'FOREIGN_KEY_CONSTRAINT');
  }
}
