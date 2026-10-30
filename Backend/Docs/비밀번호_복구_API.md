# 비밀번호 찾기: 복구코드 방식

PDF F108의 미구현 기능인 비밀번호 찾기를 구현한다. 임시 메모리 프로젝트에서 별도 메일 서버 없이 사용할 수 있도록 사용자가 선택한 **가입 시 복구코드 발급** 방식이다. 기존 비밀번호를 조회하는 대신 본인 확인 후 새 비밀번호로 변경한다.

## 사용 흐름

1. 회원가입 성공 시 응답의 `recoveryCode`를 보관한다. 화면에서 한 번 표시하며 복사 버튼을 제공한다.
2. 로그인 창에서 ‘비밀번호 찾기’를 열고 이메일·복구코드·새 비밀번호·확인 값을 입력한다.
3. 재설정 성공 시 기존 복구코드를 무효화하고 새 복구코드를 한 번 반환한다.
4. 새 코드를 보관한 후 새 비밀번호로 로그인한다. 기존 세션도 무효화 대상이며 자동 로그인은 하지 않는다.

## 회원가입 응답 변경

`POST /enjoytrip/api/members/register`의 기존 공개 필드 `id`, `name`, `email`, `createdAt`을 유지하고 `recoveryCode`를 추가한다. 상태코드는 기존처럼 201이다.

```json
{
  "data": {
    "id": "member-id",
    "name": "여행자",
    "email": "trip@example.com",
    "createdAt": "2026-10-30T06:00:00Z",
    "recoveryCode": "서버가 발급하는 43자리 복구코드"
  }
}
```

코드는 일반 로그인·회원 조회·이름 수정 응답에 포함하지 않는다.

## 비밀번호 재설정 API

- Method: `POST`
- URL: `http://127.0.0.1:8080/enjoytrip/api/auth/password-reset`
- 로그인: 불필요. 이메일과 유효한 복구코드를 모두 제시해야 한다.
- Headers: `Content-Type: application/json`, `X-Requested-With: EnjoyTrip`
- 프론트 origin: `http://127.0.0.1:5500` 또는 `http://localhost:5500`

```json
{
  "email": "trip@example.com",
  "recoveryCode": "가입 또는 직전 재설정에서 보관한 복구코드",
  "password": "newPassword123!",
  "passwordConfirm": "newPassword123!"
}
```

성공: **200**, 위 가입 응답과 같은 공개 회원 필드와 **새 `recoveryCode`**를 반환한다.

| 상황 | 응답 |
| --- | --- |
| 없는 이메일·잘못된 코드·이미 사용한 코드 | 400 `INVALID_RECOVERY`, 동일한 안내 문구 |
| 이메일 형식 오류·8자 미만·비밀번호 확인 불일치·미정의 JSON 필드 | 400 `VALIDATION_ERROR` |
| 허용되지 않은 Origin·변경 요청 헤더 누락 | 403 `FORBIDDEN` |
| POST 이외의 실제 요청 | 405 `METHOD_NOT_ALLOWED` |

오류는 기존 형식인 `{"error":{"code":"...","message":"..."}}`를 사용한다. 비밀번호는 공백을 제거하지 않고 확인 값과 일치해야 한다.

## 저장·인증 정책

- 복구코드는 `SecureRandom`의 32바이트 난수를 URL 안전 Base64로 표현한다. 원문 대신 SHA-256 해시만 Member에 보관한다.
- 성공한 재설정에서 비밀번호 salt·PBKDF2 해시와 복구코드 해시를 함께 교체한다. 공통 잠금 안에서 최종 코드를 다시 확인하므로 동시 요청도 한 번만 성공한다.
- Member의 내부 `credentialVersion`을 증가시키고 로그인 당시 세션 버전과 비교한다. 해당 회원의 기존 세션은 다음 인증에서 거절하며, 다른 회원의 세션은 유지한다.
- 일반 HTTP 응답에는 비밀번호 해시·salt·복구코드 해시·세션 버전을 포함하지 않는다. 복구 요청·성공 DTO의 `toString()`도 비밀값을 숨긴다.
- 응답은 `Cache-Control: no-store`를 유지한다. 화면에서 코드 창을 닫으면 표시한 코드를 비우고, 재설정 창을 닫으면 입력한 코드·비밀번호를 비운다. localStorage/sessionStorage에는 코드를 저장하지 않는다.
- 코드를 잃어버리면 이메일만으로 계정을 복구하는 우회 절차는 제공하지 않는다. 서버 재시작 시 모든 회원과 복구 정보가 소멸하는 기존 메모리 DAO 수명은 동일하다.

구현: `AuthController`, `BasicMemberService`, `RecoveryCodes`, `Member`, `auth-recovery.js`. 일반 API 규칙과 Live Server/Tomcat 실행 방법은 루트 README를 따른다.
