package enjoytrip.model.service;

public final class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    public ApiException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
    public int status() { return status; }
    public String code() { return code; }
    public static ApiException validation(String message) {
        return new ApiException(400, "VALIDATION_ERROR", message);
    }
    public static ApiException loginRequired() {
        return new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요합니다.");
    }
}
