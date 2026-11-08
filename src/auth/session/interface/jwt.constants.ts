/** 세션 JWT 서명·검증 알고리즘. 검증 시 이 값만 허용해 alg 혼동 공격을 막습니다. */
export const JWT_ALGORITHM = 'HS256' as const;
