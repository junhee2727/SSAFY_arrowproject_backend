package enjoytrip.model.service;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.GeneralSecurityException;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

final class PasswordHasher {
    private static final int ITERATIONS = 200_000;
    private static final SecureRandom RANDOM = new SecureRandom();
    record Encoded(String hash, String salt) {}
    static Encoded encode(String password) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return new Encoded(Base64.getEncoder().encodeToString(derive(password, salt)),
                Base64.getEncoder().encodeToString(salt));
    }
    static boolean matches(String password, String hash, String salt) {
        return MessageDigest.isEqual(Base64.getDecoder().decode(hash),
                derive(password, Base64.getDecoder().decode(salt)));
    }
    private static byte[] derive(String password, byte[] salt) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, 256);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Password hashing unavailable", e);
        } finally {
            spec.clearPassword();
        }
    }
}
