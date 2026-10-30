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
}
