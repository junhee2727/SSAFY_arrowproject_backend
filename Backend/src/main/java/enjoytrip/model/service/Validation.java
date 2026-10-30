package enjoytrip.model.service;

import java.util.Locale;
import java.util.regex.Pattern;

final class Validation {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private Validation() {}
    static String text(String value, int min, int max, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() < min || normalized.length() > max) {
            throw ApiException.validation(label + "은(는) " + min + "자 이상 " + max + "자 이하로 입력해주세요.");
        }
        return normalized;
    }
    static String name(String value) { return text(value, 2, 20, "이름"); }
    static String email(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(email).matches()) throw ApiException.validation("올바른 이메일을 입력해주세요.");
        return email;
    }
}
