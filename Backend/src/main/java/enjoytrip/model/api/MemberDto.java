package enjoytrip.model.api;

// 회원 응답 DTO: 가입·로그인·내 정보 조회·수정에서 공통 사용
public record MemberDto(
        String id,
        String name,
        String email,
        String createdAt
) {
    public record SignupRequest(
            String name,
            String email,
            String password,
            String passwordConfirm,
            Boolean terms
    ) {
        @Override
        public String toString() {
            return "SignupRequest[REDACTED]";
        }
    }

    public record LoginRequest(String email, String password) {
        @Override
        public String toString() {
            return "LoginRequest[REDACTED]";
        }
    }

    public record UpdateRequest(String name) {
    }

    // 가입·재설정 성공 시에만 한 번 반환한다. 일반 회원 조회에는 복구코드가 없다.
    public record RecoveryResponse(String id, String name, String email, String createdAt, String recoveryCode) {
        @Override
        public String toString() { return "RecoveryResponse[REDACTED]"; }
    }

    public record PasswordResetRequest(String email, String recoveryCode, String password, String passwordConfirm) {
        @Override
        public String toString() { return "PasswordResetRequest[REDACTED]"; }
    }
}
